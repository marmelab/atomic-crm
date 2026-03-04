/**
 * Internal notification helpers — email to owner + WhatsApp via CallMeBot.
 *
 * Both channels are best-effort: if one fails the other still fires.
 * Env vars are read once at cold-start for performance.
 */
import nodemailer from "npm:nodemailer";

// ── SMTP (reuses the same Gmail config as quote emails) ──────────────

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

// ── CallMeBot WhatsApp ───────────────────────────────────────────────

const callmebotPhone = Deno.env.get("CALLMEBOT_PHONE") ?? "";
const callmebotApikey = Deno.env.get("CALLMEBOT_APIKEY") ?? "";

const isCallMeBotConfigured = () => Boolean(callmebotPhone && callmebotApikey);

// ── Public API ───────────────────────────────────────────────────────

export async function sendInternalEmail(
  subject: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isSmtpConfigured()) {
    return { ok: false, error: "SMTP not configured" };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: `${smtpFromName} <${smtpUser}>`,
      to: smtpUser,
      subject,
      text,
      headers: {
        "X-Internal-Notification": "true",
      },
    });

    return { ok: true };
  } catch (error) {
    console.error("internal_email.error", error);
    return { ok: false, error: String(error) };
  }
}

export async function sendWhatsApp(
  message: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isCallMeBotConfigured()) {
    return { ok: false, error: "CallMeBot not configured" };
  }

  try {
    const url = new URL("https://api.callmebot.com/whatsapp.php");
    url.searchParams.set("phone", callmebotPhone);
    url.searchParams.set("text", message);
    url.searchParams.set("apikey", callmebotApikey);

    const response = await fetch(url.toString(), { method: "GET" });

    if (!response.ok) {
      const body = await response.text();
      console.error("callmebot.error", { status: response.status, body });
      return { ok: false, error: `CallMeBot HTTP ${response.status}` };
    }

    return { ok: true };
  } catch (error) {
    console.error("callmebot.error", error);
    return { ok: false, error: String(error) };
  }
}

/**
 * Notify the owner via both email and WhatsApp.
 * Best-effort: neither channel blocks or fails the caller.
 */
export async function notifyOwner(
  subject: string,
  message: string,
): Promise<{
  email: { ok: boolean; error?: string };
  whatsapp: { ok: boolean; error?: string };
}> {
  const [email, whatsapp] = await Promise.all([
    sendInternalEmail(subject, message),
    sendWhatsApp(message),
  ]);

  return { email, whatsapp };
}
