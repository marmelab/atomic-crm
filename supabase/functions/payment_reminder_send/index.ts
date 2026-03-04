import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import nodemailer from "npm:nodemailer";

import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { getUserSale } from "../_shared/getUserSale.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import {
  validatePaymentReminderSendPayload,
  type PaymentReminderSendPayload,
} from "../_shared/paymentReminderSend.ts";
import { notifyOwner } from "../_shared/internalNotifications.ts";

const smtpHost = Deno.env.get("SMTP_HOST") ?? "";
const smtpPort = Number(Deno.env.get("SMTP_PORT") ?? "587");
const smtpUser = Deno.env.get("SMTP_USER") ?? "";
const smtpPass = Deno.env.get("SMTP_PASS") ?? "";
const smtpFromName = Deno.env.get("SMTP_FROM_NAME") ?? "Rosario Furnari";

const isSmtpConfigured = () =>
  Boolean(
    smtpHost &&
      Number.isFinite(smtpPort) &&
      smtpPort > 0 &&
      smtpUser &&
      smtpPass,
  );

const formatCurrency = (value?: number) =>
  Number(value ?? 0).toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });

async function sendPaymentReminder(req: Request, currentUserSale: unknown) {
  if (!currentUserSale) {
    return createErrorResponse(401, "Unauthorized");
  }

  if (!isSmtpConfigured()) {
    return createErrorResponse(
      500,
      "SMTP non configurato nelle Edge Functions",
    );
  }

  const payload = (await req.json()) as PaymentReminderSendPayload;
  const validationError = validatePaymentReminderSendPayload(payload);
  if (validationError) {
    return createErrorResponse(400, validationError);
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const info = await transporter.sendMail({
      from: `${smtpFromName} <${smtpUser}>`,
      replyTo: smtpUser,
      to: payload.to?.trim(),
      subject: payload.subject?.trim(),
      html: payload.html,
      text: payload.text,
      headers: {
        "X-Payment-Reminder": "true",
        ...(payload.paymentId != null
          ? { "X-Payment-Id": String(payload.paymentId) }
          : {}),
      },
    });

    // Internal notification to owner (best-effort, non-blocking response)
    const clientLabel = payload.clientName ?? payload.to?.trim() ?? "Cliente";
    const amountLabel = formatCurrency(payload.amount);
    const daysLabel = payload.daysOverdue
      ? ` (scaduto da ${payload.daysOverdue}gg)`
      : "";

    const notificationResult = await notifyOwner(
      `Reminder inviato a ${clientLabel} — ${amountLabel}`,
      `Reminder pagamento inviato a ${clientLabel} per ${amountLabel}${daysLabel}`,
    );

    return new Response(
      JSON.stringify({
        data: {
          messageId: info.messageId,
          accepted: info.accepted.map(String),
          rejected: info.rejected.map(String),
          response: info.response,
          notification: notificationResult,
        },
      }),
      {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (error) {
    console.error("payment_reminder_send.error", {
      error,
      paymentId: payload.paymentId,
    });
    return createErrorResponse(
      500,
      "Impossibile inviare il reminder di pagamento",
    );
  }
}

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (request) =>
    AuthMiddleware(request, async (authedRequest) =>
      UserMiddleware(authedRequest, async (_, user) => {
        const currentUserSale = user ? await getUserSale(user) : null;
        if (!currentUserSale) {
          return createErrorResponse(401, "Unauthorized");
        }

        if (authedRequest.method === "POST") {
          return sendPaymentReminder(authedRequest, currentUserSale);
        }

        return createErrorResponse(405, "Method Not Allowed");
      }),
    ),
  ),
);
