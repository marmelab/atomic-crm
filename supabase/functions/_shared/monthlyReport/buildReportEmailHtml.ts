/**
 * buildReportEmailHtml — ren modul (vitest-bar).
 *
 * Bygger kundmailet enligt strategidokumentets sektion 7: 4–6 nyckeltal som
 * trend, en rekommenderad åtgärd. Speglar inline-CSS-stilen och Axona-header/
 * footer från quoteWorkflow/sendSigningEmail.ts buildSigningEmailHtml.
 */

import type { ReportAiContent, ReportMetrics } from "./types.ts";

/**
 * Findings som inte ska driva innehåll i KUNDmailet. missing_llms_txt döljs:
 * llms.txt är i praktiken dött (strategidok. sektion 4) — vi flaggar det internt
 * men nämner det aldrig för kund.
 */
export const CUSTOMER_HIDDEN_FINDING_KEYS = ["missing_llms_txt"];

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function deltaBadge(deltaPct: number | null, lowerIsBetter = false): string {
  if (deltaPct == null) return "";
  const rounded = Math.round(deltaPct);
  if (rounded === 0) {
    return `<span style="color:#a3a3a3;font-size:13px;">oförändrat</span>`;
  }
  const improved = lowerIsBetter ? rounded < 0 : rounded > 0;
  const color = improved ? "#16a34a" : "#dc2626";
  const arrow = rounded > 0 ? "▲" : "▼";
  return `<span style="color:${color};font-size:13px;font-weight:600;">${arrow} ${rounded > 0 ? "+" : ""}${rounded}%</span>`;
}

function metricRow(
  icon: string,
  label: string,
  value: string,
  badge: string,
): string {
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:15px;color:#0a0a0a;">${icon} ${escapeHtml(label)}</td>
    <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:15px;color:#0a0a0a;text-align:right;font-weight:600;">${escapeHtml(value)} ${badge}</td>
  </tr>`;
}

export type BuildReportEmailInput = {
  companyName: string;
  periodLabel: string;
  aiContent: ReportAiContent;
  metrics: ReportMetrics;
  hasSearchData: boolean;
  /** From-adress för en "svara på mejlet"-CTA. */
  replyToEmail: string;
};

export function buildReportEmailHtml(input: BuildReportEmailInput): string {
  const { metrics, aiContent } = input;
  const rows: string[] = [];

  if (input.hasSearchData) {
    if (metrics.impressions.current != null) {
      rows.push(
        metricRow(
          "👁️",
          "Visningar i Google",
          metrics.impressions.current.toLocaleString("sv-SE"),
          deltaBadge(metrics.impressions.deltaPct),
        ),
      );
    }
    if (metrics.clicks.current != null) {
      rows.push(
        metricRow(
          "🖱️",
          "Klick till er sajt",
          metrics.clicks.current.toLocaleString("sv-SE"),
          deltaBadge(metrics.clicks.deltaPct),
        ),
      );
    }
    if (metrics.position.current != null) {
      rows.push(
        metricRow(
          "📍",
          "Snittposition (lägre är bättre)",
          metrics.position.current.toFixed(1),
          deltaBadge(metrics.position.deltaPct, true),
        ),
      );
    }
    if (metrics.topQueries.length > 0) {
      rows.push(
        metricRow(
          "🔍",
          "Vanligaste sökorden",
          metrics.topQueries
            .slice(0, 3)
            .map((q) => q.query)
            .join(", "),
          "",
        ),
      );
    }
  }
  if (metrics.lcp_ms.current != null) {
    const seconds = (metrics.lcp_ms.current / 1000).toFixed(1);
    const ok = metrics.lcp_ms.current <= 2500;
    rows.push(
      metricRow(
        "⚡",
        "Laddtid",
        `${seconds} s`,
        `<span style="color:${ok ? "#16a34a" : "#d97706"};font-size:13px;">${ok ? "snabbt nog" : "kan bli bättre"}</span>`,
      ),
    );
  }

  const safeCompany = escapeHtml(input.companyName);
  const safePeriod = escapeHtml(input.periodLabel);
  const safeMailto = `mailto:${encodeURIComponent(input.replyToEmail)}`;

  return `<!DOCTYPE html>
<html lang="sv">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:Inter,-apple-system,sans-serif;margin:0;padding:0;background:#f5f5f5;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#0a0a0a;padding:32px 40px;">
      <h1 style="color:#fff;font-size:20px;margin:0;">Er synlighet i ${safePeriod}</h1>
      <p style="color:#a3a3a3;font-size:14px;margin:8px 0 0;">${safeCompany} · Axona Digital AB</p>
    </div>
    <div style="padding:40px;">
      <p style="font-size:15px;color:#0a0a0a;line-height:1.6;margin:0 0 16px;">${escapeHtml(aiContent.greeting)}</p>
      <p style="font-size:15px;color:#525252;line-height:1.6;margin:0 0 24px;">${escapeHtml(aiContent.summary)}</p>

      <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
        ${rows.join("\n")}
      </table>

      <div style="background:#f0f7ff;border:1px solid #d6e7ff;border-radius:10px;padding:20px 24px;margin:0 0 24px;">
        <p style="font-size:13px;font-weight:700;color:#1d4ed8;text-transform:uppercase;letter-spacing:0.04em;margin:0 0 8px;">Vad vi rekommenderar härnäst</p>
        <p style="font-size:15px;color:#0a0a0a;line-height:1.6;margin:0 0 8px;">${escapeHtml(aiContent.recommended_action)}</p>
        <p style="font-size:14px;color:#525252;line-height:1.6;margin:0;">${escapeHtml(aiContent.upsell_pitch)}</p>
      </div>

      <div style="text-align:center;margin:32px 0 8px;">
        <a href="${safeMailto}" style="display:inline-block;padding:14px 32px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">Prata med oss om nästa steg</a>
      </div>
      <p style="font-size:13px;color:#a3a3a3;line-height:1.6;margin:24px 0 0;text-align:center;">Svara gärna på det här mejlet så hör vi av oss.</p>
    </div>
    <div style="padding:24px 40px;background:#fafafa;border-top:1px solid #e5e5e5;">
      <p style="font-size:12px;color:#a3a3a3;margin:0;">Axona Digital AB | Östersund, Sverige</p>
    </div>
  </div>
</body>
</html>`;
}
