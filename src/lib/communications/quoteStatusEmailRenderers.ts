import type { EmailSection } from "./quoteStatusEmailTypes";

// Re-export copy builders for backward compatibility
export { buildSummaryRows, buildStatusCopy, formatCurrency } from "./quoteStatusEmailCopy";

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

// ── HTML renderer ─────────────────────────────────────────────────────

export const renderHtml = ({
  businessName,
  previewText,
  subject,
  intro,
  summaryRows,
  sections,
  ctaLabel,
  ctaUrl,
  supportEmail,
}: {
  businessName: string;
  previewText: string;
  subject: string;
  intro: string;
  summaryRows: Array<{ label: string; value: string }>;
  sections: EmailSection[];
  ctaLabel?: string;
  ctaUrl?: string;
  supportEmail?: string | null;
}) => {
  const summaryHtml = summaryRows
    .map(
      (row) => `
        <tr>
          <td style="padding:8px 0;color:#64748b;font-size:13px;">${escapeHtml(row.label)}</td>
          <td style="padding:8px 0;color:#0f172a;font-size:13px;font-weight:600;text-align:right;">${escapeHtml(row.value)}</td>
        </tr>`,
    )
    .join("");

  const sectionsHtml = sections
    .map(
      (section) => `
        <div style="margin-top:20px;">
          <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#0f172a;">${escapeHtml(section.title)}</p>
          ${toParagraphs(section.body)
            .map(
              (paragraph) =>
                `<p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#334155;">${escapeHtml(paragraph)}</p>`,
            )
            .join("")}
        </div>`,
    )
    .join("");

  const ctaHtml =
    ctaLabel && ctaUrl
      ? `<div style="margin-top:24px;">
          <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-size:14px;font-weight:700;">${escapeHtml(ctaLabel)}</a>
        </div>`
      : "";

  const footerHtml = supportEmail
    ? `<p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#64748b;">Se ti serve un chiarimento puoi rispondere a questa mail o scrivere a ${escapeHtml(
        supportEmail,
      )}.</p>`
    : `<p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#64748b;">Se ti serve un chiarimento puoi rispondere a questa mail.</p>`;

  return `<!doctype html>
<html lang="it">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(previewText)}</div>
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
      <div style="padding:24px 24px 16px;background:#0f172a;color:#ffffff;">
        <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#cbd5e1;">Aggiornamento preventivo</p>
        <h1 style="margin:0;font-size:24px;line-height:1.3;">${escapeHtml(subject)}</h1>
        <p style="margin:10px 0 0;font-size:14px;line-height:1.6;color:#cbd5e1;">${escapeHtml(businessName)}</p>
      </div>
      <div style="padding:24px;">
        ${toParagraphs(intro)
          .map(
            (paragraph) =>
              `<p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#334155;">${escapeHtml(paragraph)}</p>`,
          )
          .join("")}
        <div style="margin-top:20px;padding:16px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;">
          <table style="width:100%;border-collapse:collapse;">${summaryHtml}</table>
        </div>
        ${sectionsHtml}
        ${ctaHtml}
        ${footerHtml}
      </div>
    </div>
  </body>
</html>`;
};

// ── Plain text renderer ───────────────────────────────────────────────

export const renderText = ({
  businessName,
  subject,
  intro,
  summaryRows,
  sections,
  ctaLabel,
  ctaUrl,
  supportEmail,
}: {
  businessName: string;
  subject: string;
  intro: string;
  summaryRows: Array<{ label: string; value: string }>;
  sections: EmailSection[];
  ctaLabel?: string;
  ctaUrl?: string;
  supportEmail?: string | null;
}) =>
  [
    businessName,
    subject,
    "",
    ...toParagraphs(intro),
    "",
    "Riepilogo",
    ...summaryRows.map((row) => `- ${row.label}: ${row.value}`),
    "",
    ...sections.flatMap((section) => [
      section.title,
      ...toParagraphs(section.body),
      "",
    ]),
    ...(ctaLabel && ctaUrl ? [`${ctaLabel}: ${ctaUrl}`, ""] : []),
    supportEmail
      ? `Per chiarimenti puoi rispondere a questa mail o scrivere a ${supportEmail}.`
      : "Per chiarimenti puoi rispondere a questa mail.",
  ].join("\n");
