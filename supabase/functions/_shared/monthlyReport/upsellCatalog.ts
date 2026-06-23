/**
 * Upsell-katalog för månadsrapporten — ren modul (vitest-bar).
 *
 * Findings i website_snapshots mappar redan varje brist till en Axona-tjänst via
 * finding.service (SERVICES-objektet i analyze_website/findings.ts). Den här
 * katalogen mappar service-strängen → ett kundvänt upsell-erbjudande.
 *
 * Defaults kommer från strategidokumentets upsell-spelbok (docs/seo-geo-strategi.md
 * sektion 6). Edge-funktionen kan överstyra via configuration.monthlyReport.upsellCatalog.
 *
 * Per beslut: INGA priser i katalogen — rapporten väcker behovet, priset tas i dialog.
 */

import type { ReportFinding, UpsellOffer } from "./types.ts";

// service-värdena måste matcha SERVICES i analyze_website/findings.ts exakt.
export const DEFAULT_UPSELL_CATALOG: UpsellOffer[] = [
  {
    service: "Prestandaoptimering",
    label: "Prestandaoptimering",
    description:
      "Er sida laddar långsamt — och varje sekund kostar er besökare som annars blivit kunder.",
    pitch:
      "Vi gör sidan snabbare. Snabbare laddning ger lägre avhopp och fler bokningar/förfrågningar — en direkt effekt på er affär.",
  },
  {
    service: "SEO-optimering",
    label: "SEO-optimering",
    description:
      "Ni ligger nära förstasidan på Google men inte riktigt framme — där de flesta klicken finns.",
    pitch:
      "Ni är några steg från förstasidan på era viktigaste sökord. Det här är den snabbaste synlighetsvinsten ni kan göra.",
  },
  {
    service: "AI-sök-optimering",
    label: "AI-sök-optimering",
    description:
      "När folk frågar ChatGPT, Claude eller Google AI om er bransch nämns ni sällan.",
    pitch:
      "Sökning flyttar till AI-svar. Vi strukturerar ert innehåll så att AI förstår och rekommenderar er — inte konkurrenten.",
  },
  {
    service: "Google Business-paket",
    label: "Google Business-paket",
    description:
      "Er Google Business-profil saknas eller har för få/för gamla recensioner — där de lokala kunderna letar.",
    pitch:
      "Vi sätter upp och vårdar er Google Business-profil och bygger en rutin för jämn ström av recensioner — högst ROI för lokala företag.",
  },
  {
    service: "Innehåll & synlighet",
    label: "Innehåll & synlighet",
    description:
      "Google och AI förstår inte riktigt vad ni erbjuder — innehållet behöver stärkas.",
    pitch:
      "Vi gör innehållet tydligt och begripligt för både Google och AI, så att ni dyker upp där era kunder faktiskt frågar.",
  },
];

const SEVERITY_RANK: Record<ReportFinding["severity"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/**
 * Välj upsell-erbjudanden utifrån kundens findings.
 *
 * - Grupperar findings på service och slår upp katalogposten.
 * - Sorterar så att den service som har den allvarligaste bristen kommer först.
 * - Returnerar ALLA matchande (så teamet kan byta i CRM-modalen). Mailet visar
 *   den första (högst prioriterade) — strategidokumentet: "exakt en åtgärd".
 *
 * `hiddenKeys` filtrerar bort findings som inte ska driva en upsell i kundmailet
 * (t.ex. missing_llms_txt — llms.txt är i praktiken dött).
 */
export function selectUpsells(
  findings: ReportFinding[] | null | undefined,
  catalog: UpsellOffer[] = DEFAULT_UPSELL_CATALOG,
  hiddenKeys: string[] = [],
): UpsellOffer[] {
  if (!findings || findings.length === 0) return [];
  const hidden = new Set(hiddenKeys);
  const catalogByService = new Map(catalog.map((o) => [o.service, o]));

  // Bästa (lägsta) severity-rank per service.
  const bestRankByService = new Map<string, number>();
  for (const finding of findings) {
    if (hidden.has(finding.key)) continue;
    const rank = SEVERITY_RANK[finding.severity];
    const existing = bestRankByService.get(finding.service);
    if (existing === undefined || rank < existing) {
      bestRankByService.set(finding.service, rank);
    }
  }

  return [...bestRankByService.entries()]
    .filter(([service]) => catalogByService.has(service))
    .sort((a, b) => a[1] - b[1])
    .map(([service]) => catalogByService.get(service)!);
}
