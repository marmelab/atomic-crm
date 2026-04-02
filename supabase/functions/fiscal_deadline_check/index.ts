import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { AuthMiddleware } from "../_shared/authentication.ts";
import { getBusinessYear, todayISODate } from "../_shared/dateTimezone.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import {
  buildDeadlineNotificationMessage,
  buildFiscalReminderComputation,
  buildTaskPayloads,
  type FiscalConfig,
  type FiscalDeadline,
  type FiscalWarning,
  type FiscalTaskPayload,
  type PaymentRow,
  type ProjectRow,
} from "../_shared/fiscalDeadlineCalculation.ts";
import { notifyOwner } from "../_shared/internalNotifications.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { createErrorResponse } from "../_shared/utils.ts";

const FISCAL_TASK_TYPES = new Set(["f24", "inps", "bollo", "dichiarazione"]);

/** Deadlines within this many days get a task created */
const TASK_REMINDER_DAYS = 30;
/** Deadlines within this many days trigger a notification */
const NOTIFY_DAYS = 7;

type CheckResult = {
  deadlinesFound: number;
  tasksCreated: number;
  notificationSent: boolean;
  details: string;
};

// ── Helpers ───────────────────────────────────────────────────────────

async function loadFiscalConfig(): Promise<FiscalConfig | null> {
  const { data: configRow, error } = await supabaseAdmin
    .from("configuration")
    .select("config")
    .eq("id", 1)
    .single();

  if (error || !configRow?.config) {
    throw new Error(
      `Cannot read configuration: ${error?.message ?? "no config row"}`,
    );
  }

  const appConfig = configRow.config as Record<string, unknown>;
  const fiscalConfig = appConfig.fiscalConfig as FiscalConfig | undefined;
  return fiscalConfig ?? null;
}

async function loadYearData(paymentYear: number) {
  const paymentsRangeStart = `${paymentYear - 3}-01-01`;
  const paymentsRangeEnd = `${paymentYear + 1}-01-01`;

  const [paymentsResult, projectsResult, earliestPaymentResult] =
    await Promise.all([
      supabaseAdmin
        .from("payments")
        .select(
          "payment_type, client_id, project_id, payment_date, status, amount",
        )
        .gte("payment_date", paymentsRangeStart)
        .lt("payment_date", paymentsRangeEnd),
      supabaseAdmin.from("projects").select("id, category"),
      supabaseAdmin
        .from("payments")
        .select("payment_date")
        .not("payment_date", "is", null)
        .order("payment_date", { ascending: true })
        .limit(1),
    ]);

  return {
    payments: (paymentsResult.data ?? []) as PaymentRow[],
    projects: (projectsResult.data ?? []) as ProjectRow[],
    inferredActivityStartYear:
      earliestPaymentResult.data?.[0]?.payment_date != null
        ? getBusinessYear(String(earliestPaymentResult.data[0].payment_date))
        : null,
  };
}

async function createMissingTasks(
  upcomingDeadlines: FiscalDeadline[],
  currentYear: number,
): Promise<{ created: number; needed: number }> {
  const yearStart = `${currentYear}-01-01`;
  const taskYearEnd = `${currentYear + 1}-03-31`;
  const { data: existingTasks } = await supabaseAdmin
    .from("client_tasks")
    .select("text, type, due_date")
    .gte("due_date", yearStart)
    .lte("due_date", taskYearEnd);

  const existingSignatures = new Set(
    (existingTasks ?? [])
      .filter((t: { type: string }) => FISCAL_TASK_TYPES.has(t.type))
      .map(
        (t: { type: string; due_date: string }) =>
          `${t.type}::${t.due_date?.substring(0, 10)}`,
      ),
  );

  const allPayloads: FiscalTaskPayload[] = buildTaskPayloads(upcomingDeadlines);
  const newPayloads = allPayloads.filter(
    (task) =>
      !existingSignatures.has(
        `${task.type}::${task.due_date.substring(0, 10)}`,
      ),
  );

  let created = 0;
  for (const task of newPayloads) {
    const { error } = await supabaseAdmin.from("client_tasks").insert(task);
    if (!error) created++;
    else console.error("fiscal_deadline_check.task_insert_error", error);
  }

  return { created, needed: newPayloads.length };
}

async function notifyImminent(
  upcomingDeadlines: FiscalDeadline[],
): Promise<boolean> {
  const imminent = upcomingDeadlines.filter((d) => d.daysUntil <= NOTIFY_DAYS);
  if (imminent.length === 0) return false;

  const message = buildDeadlineNotificationMessage(imminent);
  const n = imminent.length;
  const subject = `⏰ ${n} scadenz${n === 1 ? "a" : "e"} fiscali stimate entro ${NOTIFY_DAYS} giorni`;

  const result = await notifyOwner(subject, message);
  console.warn("fiscal_deadline_check.notification", {
    deadlines: n,
    email: result.email,
    whatsapp: result.whatsapp,
  });
  return result.email.ok || result.whatsapp.ok;
}

const logFiscalWarnings = (warnings: FiscalWarning[]) => {
  for (const warning of warnings) {
    console.warn("fiscal_deadline_check.estimate_warning", {
      code: warning.code,
      taxYear: warning.taxYear,
      amount: warning.amount,
      paymentYear: warning.paymentYear,
      severity: warning.severity,
      message: warning.message,
    });
  }
};

// ── Orchestrator ──────────────────────────────────────────────────────

async function runFiscalDeadlineCheck(): Promise<CheckResult> {
  const todayStr = todayISODate();
  const currentYear = Number(todayStr.slice(0, 4));

  const fiscalConfig = await loadFiscalConfig();
  if (!fiscalConfig) {
    return {
      deadlinesFound: 0,
      tasksCreated: 0,
      notificationSent: false,
      details: "No fiscal configuration found — skipping",
    };
  }

  const { payments, projects, inferredActivityStartYear } =
    await loadYearData(currentYear);
  const computation = buildFiscalReminderComputation({
    config: fiscalConfig,
    payments,
    projects,
    paymentYear: currentYear,
    todayIso: todayStr,
    inferredActivityStartYear,
  });
  const deadlines = computation.schedule.deadlines;
  logFiscalWarnings(computation.warnings);

  const upcoming = deadlines.filter(
    (d) => !d.isPast && d.daysUntil <= TASK_REMINDER_DAYS,
  );
  if (upcoming.length === 0) {
    return {
      deadlinesFound: deadlines.length,
      tasksCreated: 0,
      notificationSent: false,
      details: `${deadlines.length} deadlines found, none within ${TASK_REMINDER_DAYS} days${computation.warnings.length > 0 ? `, ${computation.warnings.length} warning(s)` : ""}`,
    };
  }

  const { created, needed } = await createMissingTasks(upcoming, currentYear);
  const notificationSent = await notifyImminent(upcoming);

  return {
    deadlinesFound: deadlines.length,
    tasksCreated: created,
    notificationSent,
    details: `${upcoming.length} upcoming, ${needed} new tasks needed, ${created} created${notificationSent ? ", notification sent" : ""}${computation.warnings.length > 0 ? `, ${computation.warnings.length} warning(s)` : ""}`,
  };
}

// ── HTTP handler ──────────────────────────────────────────────────────

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) =>
    AuthMiddleware(req, async () => {
      if (req.method !== "POST") {
        return createErrorResponse(405, "Method Not Allowed");
      }

      try {
        const result = await runFiscalDeadlineCheck();

        console.warn("fiscal_deadline_check.completed", result);

        return new Response(JSON.stringify({ data: result }), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      } catch (error) {
        console.error("fiscal_deadline_check.error", error);
        return createErrorResponse(
          500,
          `Fiscal deadline check failed: ${String(error)}`,
        );
      }
    }),
  ),
);
