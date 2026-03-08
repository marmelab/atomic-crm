import type { EmailSection } from "./quoteStatusEmailTypes";

// Re-export copy builders for backward compatibility
export {
  buildSummaryRows,
  buildStatusCopy,
  formatCurrency,
} from "./quoteStatusEmailCopy";

// ── Helpers ───────────────────────────────────────────────────────────

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const toParagraphs = (value: string) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

// ── Status color map (hex equivalents of Tailwind palette) ───────────

export type StatusColorScheme = {
  accent: string;
  accentLight: string;
  accentText: string;
};

const statusColors: Record<string, StatusColorScheme> = {
  primo_contatto: {
    accent: "#94a3b8",
    accentLight: "#f1f5f9",
    accentText: "#334155",
  },
  preventivo_inviato: {
    accent: "#3b82f6",
    accentLight: "#eff6ff",
    accentText: "#1e40af",
  },
  in_trattativa: {
    accent: "#f59e0b",
    accentLight: "#fffbeb",
    accentText: "#92400e",
  },
  accettato: {
    accent: "#22c55e",
    accentLight: "#f0fdf4",
    accentText: "#166534",
  },
  acconto_ricevuto: {
    accent: "#14b8a6",
    accentLight: "#f0fdfa",
    accentText: "#115e59",
  },
  in_lavorazione: {
    accent: "#8b5cf6",
    accentLight: "#f5f3ff",
    accentText: "#5b21b6",
  },
  completato: {
    accent: "#0ea5e9",
    accentLight: "#f0f9ff",
    accentText: "#075985",
  },
  saldato: {
    accent: "#10b981",
    accentLight: "#ecfdf5",
    accentText: "#065f46",
  },
  rifiutato: {
    accent: "#f87171",
    accentLight: "#fef2f2",
    accentText: "#991b1b",
  },
  perso: {
    accent: "#a8a29e",
    accentLight: "#fafaf9",
    accentText: "#57534e",
  },
};

const defaultColors: StatusColorScheme = {
  accent: "#3b82f6",
  accentLight: "#eff6ff",
  accentText: "#1e40af",
};

export const getStatusColors = (status: string): StatusColorScheme =>
  statusColors[status] ?? defaultColors;

// ── Logo URL ─────────────────────────────────────────────────────────

const LOGO_URL =
  "https://gestionale-rosario.vercel.app/logos/logo_rosario_furnari-96.png";

// ── Structural colors — Navy & Petrolio (aligned with PDF) ───────────
const sc = {
  ink: "#1C1C1E",
  body: "#3A3A3C",
  mid: "#8E8E93",
  rule: "#D1D1D6",
  faint: "#F2F2F7",
  navy: "#2C3E50",
  navyLight: "#E8EDF2",
  white: "#FFFFFF",
};

// ── HTML renderer — Bambino + Neuro design ───────────────────────────

export const renderHtml = ({
  businessName,
  previewText,
  subject,
  headline,
  intro,
  summaryRows,
  sections,
  ctaLabel,
  ctaUrl,
  supportEmail,
  status,
  amount,
  amountPaid,
  hasPdfAttachment,
}: {
  businessName: string;
  previewText: string;
  subject: string;
  headline: string;
  intro: string;
  summaryRows: Array<{ label: string; value: string }>;
  sections: EmailSection[];
  ctaLabel?: string;
  ctaUrl?: string;
  supportEmail?: string | null;
  status: string;
  amount?: number | null;
  amountPaid?: number | null;
  hasPdfAttachment?: boolean;
}) => {
  const colors = getStatusColors(status);
  const totalAmount = Number(amount ?? 0);
  const paidAmount = Number(amountPaid ?? 0);
  const progressPercent =
    totalAmount > 0 ? Math.min(100, Math.round((paidAmount / totalAmount) * 100)) : 0;
  const showProgress = totalAmount > 0;

  const fmtAmount = (value: number) =>
    value.toLocaleString("it-IT", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
    });

  const summaryHtml = summaryRows
    .map(
      (row) => `
        <tr>
          <td style="padding:6px 0;color:${sc.mid};font-size:13px;">${escapeHtml(row.label)}</td>
          <td style="padding:6px 0;color:${sc.ink};font-size:13px;font-weight:600;text-align:right;">${escapeHtml(row.value)}</td>
        </tr>`,
    )
    .join("");

  const sectionsHtml = sections
    .map(
      (section) => `
        <div style="margin-top:16px;">
          ${toParagraphs(section.body)
            .map(
              (paragraph) =>
                `<p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:${sc.body};">${escapeHtml(paragraph)}</p>`,
            )
            .join("")}
        </div>`,
    )
    .join("");

  const ctaHtml =
    ctaLabel && ctaUrl
      ? `<div style="text-align:center;margin-top:24px;">
          <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:${colors.accent};color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:700;letter-spacing:0.02em;">${escapeHtml(ctaLabel)}</a>
        </div>`
      : "";

  const pdfIndicatorHtml = hasPdfAttachment
    ? `<div style="margin-top:20px;padding:12px 16px;background:${sc.faint};border:1px solid ${sc.rule};border-radius:8px;text-align:center;">
        <span style="font-size:13px;color:${sc.mid};">&#128206; Preventivo PDF completo in allegato</span>
      </div>`
    : "";

  const footerHtml = supportEmail
    ? `Per chiarimenti puoi rispondere a questa mail o scrivere a <a href="mailto:${escapeHtml(supportEmail)}" style="color:${sc.navy};text-decoration:none;font-weight:600;">${escapeHtml(supportEmail)}</a>.`
    : "Per chiarimenti puoi rispondere direttamente a questa mail.";

  return `<!doctype html>
<html lang="it">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:${sc.navyLight};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(previewText)}</div>
    <div style="max-width:600px;margin:0 auto;padding:24px 16px;">

      <!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
      <div style="background:${sc.white};border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

        <!-- Logo + Brand -->
        <div style="padding:28px 32px 20px;text-align:center;">
          <img src="${LOGO_URL}" alt="${escapeHtml(businessName)}" width="56" height="56" style="border-radius:50%;display:inline-block;" />
          <p style="margin:12px 0 0;font-size:18px;font-weight:700;color:${sc.ink};letter-spacing:-0.01em;">${escapeHtml(businessName)}</p>
        </div>

        <!-- Status color band -->
        <div style="height:4px;background:${colors.accent};"></div>

        <!-- Headline -->
        <div style="padding:28px 32px 0;text-align:center;">
          <h1 style="margin:0;font-size:22px;font-weight:700;color:${sc.ink};line-height:1.3;">${escapeHtml(headline)}</h1>
        </div>

        <!-- Main content -->
        <div style="padding:20px 32px 0;">

          <!-- Intro -->
          ${toParagraphs(intro)
            .map(
              (paragraph) =>
                `<p style="margin:0 0 10px;font-size:15px;line-height:1.7;color:${sc.body};">${escapeHtml(paragraph)}</p>`,
            )
            .join("")}

          ${
            showProgress
              ? `<!-- Amount hero block -->
          <div style="margin-top:20px;padding:24px;background:${colors.accentLight};border-radius:12px;text-align:center;">
            <p style="margin:0;font-size:32px;font-weight:800;color:${colors.accentText};letter-spacing:-0.02em;">${fmtAmount(totalAmount)}</p>
            ${
              paidAmount > 0
                ? `<!-- Progress bar -->
            <div style="margin:16px auto 0;max-width:280px;">
              <div style="background:${sc.rule};border-radius:999px;height:8px;overflow:hidden;">
                <div style="background:${colors.accent};height:8px;border-radius:999px;width:${progressPercent}%;"></div>
              </div>
              <div style="margin-top:8px;display:flex;justify-content:space-between;">
                <span style="font-size:12px;color:${colors.accentText};font-weight:600;">Pagato ${fmtAmount(paidAmount)}</span>
                <span style="font-size:12px;color:${sc.mid};">${progressPercent}%</span>
              </div>
            </div>`
                : ""
            }
          </div>`
              : ""
          }

          <!-- Summary table -->
          <div style="margin-top:20px;">
            <table style="width:100%;border-collapse:collapse;">${summaryHtml}</table>
          </div>

          ${sectionsHtml}
          ${ctaHtml}
          ${pdfIndicatorHtml}
        </div>

        <!-- Footer -->
        <div style="padding:24px 32px;margin-top:20px;border-top:1px solid ${sc.rule};">
          <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:${sc.mid};text-align:center;">${footerHtml}</p>
          <p style="margin:0;font-size:11px;color:${sc.rule};text-align:center;">${escapeHtml(businessName)}</p>
        </div>

      </div>
      <!--[if mso]></td></tr></table><![endif]-->

    </div>
  </body>
</html>`;
};

// ── Plain text renderer ───────────────────────────────────────────────

export const renderText = ({
  businessName,
  subject,
  headline,
  intro,
  summaryRows,
  sections,
  ctaLabel,
  ctaUrl,
  supportEmail,
  hasPdfAttachment,
}: {
  businessName: string;
  subject: string;
  headline?: string;
  intro: string;
  summaryRows: Array<{ label: string; value: string }>;
  sections: EmailSection[];
  ctaLabel?: string;
  ctaUrl?: string;
  supportEmail?: string | null;
  hasPdfAttachment?: boolean;
}) =>
  [
    businessName,
    "",
    headline ?? subject,
    "",
    ...toParagraphs(intro),
    "",
    ...summaryRows.map((row) => `- ${row.label}: ${row.value}`),
    "",
    ...sections.flatMap((section) => [...toParagraphs(section.body), ""]),
    ...(ctaLabel && ctaUrl ? [`${ctaLabel}: ${ctaUrl}`, ""] : []),
    ...(hasPdfAttachment ? ["Preventivo PDF completo in allegato.", ""] : []),
    supportEmail
      ? `Per chiarimenti puoi rispondere a questa mail o scrivere a ${supportEmail}.`
      : "Per chiarimenti puoi rispondere a questa mail.",
  ].join("\n");
