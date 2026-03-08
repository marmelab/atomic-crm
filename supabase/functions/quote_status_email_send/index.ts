import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import nodemailer from "npm:nodemailer";

import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { getUserSale } from "../_shared/getUserSale.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import {
  validateQuoteStatusEmailSendPayload,
  type QuoteStatusEmailSendPayload,
} from "../_shared/quoteStatusEmailSend.ts";

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

async function sendQuoteStatusEmail(req: Request, currentUserSale: unknown) {
  if (!currentUserSale) {
    return createErrorResponse(401, "Unauthorized");
  }

  if (!isSmtpConfigured()) {
    return createErrorResponse(
      500,
      "SMTP Gmail non configurato nelle Edge Functions",
    );
  }

  const payload = (await req.json()) as QuoteStatusEmailSendPayload;
  const validationError = validateQuoteStatusEmailSendPayload(payload);
  if (validationError) {
    return createErrorResponse(400, validationError);
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    // Build attachments from PDF base64 if provided
    const attachments =
      payload.pdfBase64 && payload.pdfFilename
        ? [
            {
              filename: payload.pdfFilename,
              content: payload.pdfBase64,
              encoding: "base64" as const,
              contentType: "application/pdf",
            },
          ]
        : [];

    const info = await transporter.sendMail({
      from: `${smtpFromName} <${smtpUser}>`,
      replyTo: smtpUser,
      to: payload.to?.trim(),
      subject: payload.subject?.trim(),
      html: payload.html,
      text: payload.text,
      attachments,
      headers: {
        "X-Quote-Template": payload.templateId?.trim() ?? "",
        "X-Quote-Status": payload.status?.trim() ?? "",
        "X-Quote-Email-Mode": payload.automatic ? "automatic" : "manual",
        ...(payload.quoteId != null
          ? { "X-Quote-Id": String(payload.quoteId) }
          : {}),
      },
    });

    return new Response(
      JSON.stringify({
        data: {
          messageId: info.messageId,
          accepted: info.accepted.map(String),
          rejected: info.rejected.map(String),
          response: info.response,
        },
      }),
      {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (error) {
    console.error("quote_status_email_send.error", {
      error,
      quoteId: payload.quoteId,
      status: payload.status,
      templateId: payload.templateId,
    });
    return createErrorResponse(
      500,
      "Impossibile inviare la mail cliente del preventivo",
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
          return sendQuoteStatusEmail(authedRequest, currentUserSale);
        }

        return createErrorResponse(405, "Method Not Allowed");
      }),
    ),
  ),
);
