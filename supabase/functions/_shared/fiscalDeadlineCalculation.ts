/**
 * Fiscal deadline calculation — Deno-compatible port of the client-side logic
 * in `src/components/atomic-crm/dashboard/fiscalDeadlines.ts`.
 *
 * Calculates deadlines for regime forfettario (flat-rate taxation) and builds
 * reminder task payloads for upcoming deadlines.
 */

import { toISODate } from "./dateTimezone.ts";

// ── Types ─────────────────────────────────────────────────────────────

export type FiscalConfig = {
  taxProfiles: Array<{
    atecoCode: string;
    coefficienteReddititivita: number;
    linkedCategories: string[];
  }>;
  aliquotaINPS: number;
  tettoFatturato: number;
  annoInizioAttivita: number;
  aliquotaOverride?: number | null;
};

export type DeadlineItem = {
  description: string;
  amount: number;
};

export type FiscalDeadline = {
  date: string; // YYYY-MM-DD
  label: string;
  items: DeadlineItem[];
  totalAmount: number;
  isPast: boolean;
  daysUntil: number;
  priority: "high" | "low";
};

export type FiscalTaskPayload = {
  text: string;
  type: string; // "f24" | "inps" | "bollo" | "dichiarazione"
  due_date: string; // ISO string
  done_date: null;
  client_id: null;
};

// ── Date helpers ──────────────────────────────────────────────────────

const toStartOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const diffDays = (from: Date, to: Date) => {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor(
    (toStartOfDay(to).valueOf() - toStartOfDay(from).valueOf()) / msPerDay,
  );
};

// ── Tax rate calculation ──────────────────────────────────────────────

const getAliquotaSostitutiva = (
  config: FiscalConfig,
  currentYear: number,
): number => {
  if (config.aliquotaOverride != null) return config.aliquotaOverride;
  const yearsActive = currentYear - config.annoInizioAttivita;
  return yearsActive < 5 ? 5 : 15;
};

// ── Revenue → tax estimates ───────────────────────────────────────────

export type PaymentRow = {
  amount: number;
  payment_date: string;
  status: string;
  project_id: string | null;
};

export type ProjectRow = {
  id: string;
  category: string | null;
};

/**
 * Compute fiscal estimates from payments received in the year.
 * Mirrors the client-side `buildFiscalModel` ATECO breakdown logic.
 */
export const computeFiscalEstimates = ({
  config,
  payments,
  projects,
  currentYear,
}: {
  config: FiscalConfig;
  payments: PaymentRow[];
  projects: ProjectRow[];
  currentYear: number;
}): { stimaImpostaAnnuale: number; stimaInpsAnnuale: number } => {
  // Filter: received payments in the current year
  const yearPayments = payments.filter(
    (p) =>
      p.status === "ricevuto" &&
      p.payment_date &&
      new Date(p.payment_date).getFullYear() === currentYear,
  );

  // Build project category map
  const projectCategoryMap = new Map<string, string>();
  for (const project of projects) {
    if (project.category) {
      projectCategoryMap.set(project.id, project.category);
    }
  }

  // Group revenue by ATECO profile
  const atecoRevenue = new Map<string, number>();
  for (const profile of config.taxProfiles) {
    atecoRevenue.set(profile.atecoCode, 0);
  }

  for (const payment of yearPayments) {
    const category = payment.project_id
      ? (projectCategoryMap.get(payment.project_id) ?? null)
      : null;

    // Find matching ATECO profile by category
    const matchedProfile = category
      ? config.taxProfiles.find((p) => p.linkedCategories.includes(category))
      : null;

    // Default to first ATECO profile if no match
    const targetProfile = matchedProfile ?? config.taxProfiles[0];
    if (!targetProfile) continue;

    const current = atecoRevenue.get(targetProfile.atecoCode) ?? 0;
    atecoRevenue.set(
      targetProfile.atecoCode,
      current + Number(payment.amount || 0),
    );
  }

  // Compute reddito forfettario per ATECO
  let redditoLordoForfettario = 0;
  for (const profile of config.taxProfiles) {
    const revenue = atecoRevenue.get(profile.atecoCode) ?? 0;
    redditoLordoForfettario +=
      (revenue * profile.coefficienteReddititivita) / 100;
  }

  // INPS and imposta
  const stimaInpsAnnuale =
    (redditoLordoForfettario * config.aliquotaINPS) / 100;
  const redditoImponibile = redditoLordoForfettario - stimaInpsAnnuale;
  const aliquota = getAliquotaSostitutiva(config, currentYear);
  const stimaImpostaAnnuale = (redditoImponibile * aliquota) / 100;

  return { stimaImpostaAnnuale, stimaInpsAnnuale };
};

// ── Deadline builder ──────────────────────────────────────────────────

const makeDeadline = (opts: {
  date: Date;
  label: string;
  items: DeadlineItem[];
  priority: "high" | "low";
  today: Date;
}): FiscalDeadline => ({
  date: toISODate(opts.date),
  label: opts.label,
  items: opts.items,
  totalAmount: opts.items.reduce((s, i) => s + i.amount, 0),
  isPast: opts.date < opts.today,
  daysUntil: diffDays(opts.today, opts.date),
  priority: opts.priority,
});

const buildHighPriorityDeadlines = (
  stimaImpostaAnnuale: number,
  stimaInpsAnnuale: number,
  currentYear: number,
  today: Date,
): FiscalDeadline[] => {
  const hasDoubleAcconto = stimaImpostaAnnuale > 257.52;
  const hasSingleAcconto = stimaImpostaAnnuale >= 51.65 && !hasDoubleAcconto;

  // June 30
  const juneItems: DeadlineItem[] = [
    {
      description: "Saldo Imposta Sostitutiva anno precedente",
      amount: stimaImpostaAnnuale,
    },
    {
      description: "Saldo INPS anno precedente (20%)",
      amount: stimaInpsAnnuale * 0.2,
    },
  ];
  if (hasDoubleAcconto) {
    juneItems.push({
      description: "1° Acconto Imposta Sostitutiva (50%)",
      amount: stimaImpostaAnnuale * 0.5,
    });
  }
  juneItems.push({
    description: "1° Acconto INPS Gestione Separata (40%)",
    amount: stimaInpsAnnuale * 0.4,
  });

  // November 30
  const novItems: DeadlineItem[] = [];
  if (hasDoubleAcconto) {
    novItems.push({
      description: "2° Acconto Imposta Sostitutiva (50%)",
      amount: stimaImpostaAnnuale * 0.5,
    });
  } else if (hasSingleAcconto) {
    novItems.push({
      description: "Acconto Unico Imposta Sostitutiva (100%)",
      amount: stimaImpostaAnnuale,
    });
  }
  novItems.push({
    description: "2° Acconto INPS Gestione Separata (40%)",
    amount: stimaInpsAnnuale * 0.4,
  });

  return [
    makeDeadline({
      date: new Date(currentYear, 5, 30),
      label: "Saldo + 1° Acconto",
      items: juneItems,
      priority: "high",
      today,
    }),
    makeDeadline({
      date: new Date(currentYear, 10, 30),
      label: "2° Acconto",
      items: novItems,
      priority: "high",
      today,
    }),
  ];
};

const buildLowPriorityDeadlines = (
  currentYear: number,
  today: Date,
): FiscalDeadline[] => {
  const bolloQuarters = [
    { date: new Date(currentYear, 4, 31), label: "Bollo Q1 (gen-mar)" },
    { date: new Date(currentYear, 8, 30), label: "Bollo Q2 (apr-giu)" },
    { date: new Date(currentYear, 10, 30), label: "Bollo Q3 (lug-set)" },
    { date: new Date(currentYear + 1, 1, 28), label: "Bollo Q4 (ott-dic)" },
  ];

  const deadlines = bolloQuarters.map((bq) =>
    makeDeadline({
      date: bq.date,
      label: bq.label,
      items: [
        {
          description: `Imposta di bollo fatture elettroniche — ${bq.label}`,
          amount: 0,
        },
      ],
      priority: "low",
      today,
    }),
  );

  deadlines.push(
    makeDeadline({
      date: new Date(currentYear, 9, 31),
      label: "Dichiarazione dei redditi",
      items: [
        { description: "Invio telematico Modello Redditi PF", amount: 0 },
      ],
      priority: "low",
      today,
    }),
  );

  return deadlines;
};

export const buildFiscalDeadlines = ({
  stimaImpostaAnnuale,
  stimaInpsAnnuale,
  annoInizioAttivita,
  currentYear,
  today,
}: {
  stimaImpostaAnnuale: number;
  stimaInpsAnnuale: number;
  annoInizioAttivita: number;
  currentYear: number;
  today: Date;
}): FiscalDeadline[] => {
  if (annoInizioAttivita === currentYear) return [];

  return [
    ...buildHighPriorityDeadlines(
      stimaImpostaAnnuale,
      stimaInpsAnnuale,
      currentYear,
      today,
    ),
    ...buildLowPriorityDeadlines(currentYear, today),
  ];
};

// ── Task payload builder ──────────────────────────────────────────────

const inferTaskType = (description: string): string => {
  const lower = description.toLowerCase();
  if (lower.includes("inps")) return "inps";
  if (lower.includes("imposta") || lower.includes("f24")) return "f24";
  if (lower.includes("bollo")) return "bollo";
  if (lower.includes("dichiarazione") || lower.includes("redditi"))
    return "dichiarazione";
  return "f24";
};

const formatEurAmount = (amount: number): string =>
  amount.toLocaleString("it-IT", { style: "currency", currency: "EUR" });

export const buildTaskPayloads = (
  deadlines: FiscalDeadline[],
): FiscalTaskPayload[] => {
  const tasks: FiscalTaskPayload[] = [];

  for (const deadline of deadlines) {
    for (const item of deadline.items) {
      const amountNote =
        item.amount > 0 ? ` (${formatEurAmount(item.amount)})` : "";

      tasks.push({
        text: `${item.description}${amountNote}`,
        type: inferTaskType(item.description),
        due_date: new Date(deadline.date + "T00:00:00").toISOString(),
        done_date: null,
        client_id: null,
      });
    }
  }

  return tasks;
};

// ── Notification message builder ──────────────────────────────────────

export const buildDeadlineNotificationMessage = (
  upcomingDeadlines: FiscalDeadline[],
): string => {
  const lines: string[] = ["📋 Scadenze fiscali in arrivo:", ""];

  for (const d of upcomingDeadlines) {
    const dateFormatted = new Date(d.date + "T00:00:00").toLocaleDateString(
      "it-IT",
      { day: "numeric", month: "long", year: "numeric" },
    );
    const amountStr =
      d.totalAmount > 0 ? ` — ${formatEurAmount(d.totalAmount)}` : "";
    lines.push(`⏰ ${d.label} (${dateFormatted})${amountStr}`);

    for (const item of d.items) {
      const itemAmount =
        item.amount > 0 ? `: ${formatEurAmount(item.amount)}` : "";
      lines.push(`   • ${item.description}${itemAmount}`);
    }
  }

  return lines.join("\n");
};
