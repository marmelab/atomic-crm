/**
 * Regelbaserad brist-analys för hemsidestatistik (Fas 2 av kundregistret).
 *
 * Ren modul utan Deno-beroenden så att den kan unit-testas med vitest
 * (vitest.functions.config.ts) och senare återanvändas för prospects.
 * Varje finding mappar en konkret brist till den Axona-tjänst som löser den —
 * detta är underlaget för merförsäljning.
 */

export type PageSpeedSummary = {
  performance_score: number | null;
  seo_score: number | null;
  lcp_ms: number | null;
  cls: number | null;
  tbt_ms: number | null;
  opportunities: Array<{ id: string; title: string; savings_ms: number }>;
};

export type SeoChecks = {
  title: string | null;
  meta_description: string | null;
  og_tags: boolean;
  schema_org: boolean;
  sitemap: boolean;
  robots: boolean;
  llms_txt: boolean;
  h1: boolean;
};

export type BusinessProfile = {
  found: boolean;
  rating?: number | null;
  reviews_count?: number | null;
  place_id?: string | null;
};

export type SearchConsoleSummary = {
  clicks: number;
  impressions: number;
  position: number;
  top_queries: Array<{
    query: string;
    clicks: number;
    impressions: number;
    position: number;
  }>;
};

export type FindingSeverity = "high" | "medium" | "low";

export type Finding = {
  key: string;
  severity: FindingSeverity;
  title: string;
  description: string;
  /** Axona-tjänsten som löser bristen — säljvinkeln. */
  service: string;
};

export type AnalysisInput = {
  pagespeed: PageSpeedSummary | null;
  seoChecks: SeoChecks | null;
  businessProfile: BusinessProfile | null;
  searchConsole: SearchConsoleSummary | null;
};

const SERVICES = {
  performance: "Prestandaoptimering",
  seo: "SEO-optimering",
  aiSearch: "AI-sök-optimering",
  business: "Google Business-paket",
  content: "Innehåll & synlighet",
} as const;

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toLocaleString("sv-SE", { maximumFractionDigits: 1 })} s`;
}

export function computeFindings(input: AnalysisInput): Finding[] {
  const findings: Finding[] = [];
  const { pagespeed, seoChecks, businessProfile, searchConsole } = input;

  // --- Prestanda (PageSpeed) ---
  if (pagespeed?.performance_score != null) {
    if (pagespeed.performance_score < 50) {
      findings.push({
        key: "slow_site",
        severity: "high",
        title: "Långsam hemsida",
        description: `Prestandapoäng ${pagespeed.performance_score}/100 på mobil${
          pagespeed.lcp_ms != null
            ? ` — största innehållet laddar på ${formatSeconds(pagespeed.lcp_ms)} (bör vara under 2,5 s)`
            : ""
        }. Långsamma sidor tappar besökare och rankas lägre av Google.`,
        service: SERVICES.performance,
      });
    } else if (pagespeed.performance_score < 80) {
      findings.push({
        key: "improvable_speed",
        severity: "medium",
        title: "Hemsidan kan bli snabbare",
        description: `Prestandapoäng ${pagespeed.performance_score}/100 på mobil. Det finns identifierade förbättringar som skulle ge snabbare laddning.`,
        service: SERVICES.performance,
      });
    }
  }

  if (pagespeed?.seo_score != null && pagespeed.seo_score < 70) {
    findings.push({
      key: "low_seo_score",
      severity: "high",
      title: "Brister i grundläggande SEO",
      description: `SEO-poäng ${pagespeed.seo_score}/100. Tekniska SEO-grunder saknas, vilket gör det svårare för Google att förstå och ranka sidan.`,
      service: SERVICES.seo,
    });
  }

  // --- Egen SEO/AI-sök-crawl ---
  if (seoChecks) {
    if (!seoChecks.title) {
      findings.push({
        key: "missing_title",
        severity: "high",
        title: "Saknar sidtitel",
        description:
          "Startsidan saknar <title> — det viktigaste enskilda SEO-elementet.",
        service: SERVICES.seo,
      });
    }
    if (!seoChecks.meta_description) {
      findings.push({
        key: "missing_meta_description",
        severity: "medium",
        title: "Saknar meta-beskrivning",
        description:
          "Utan meta-beskrivning väljer Google själv vilken text som visas i sökresultatet — ofta sämre för klickfrekvensen.",
        service: SERVICES.seo,
      });
    }
    if (!seoChecks.schema_org) {
      findings.push({
        key: "missing_schema_org",
        severity: "medium",
        title: "Saknar strukturerad data (schema.org)",
        description:
          "Strukturerad data hjälper Google och AI-assistenter att förstå verksamheten — krävs för utökade sökresultat och bättre AI-synlighet.",
        service: SERVICES.aiSearch,
      });
    }
    if (!seoChecks.llms_txt) {
      findings.push({
        key: "missing_llms_txt",
        severity: "low",
        title: "Saknar llms.txt",
        description:
          "Allt fler kunder söker via AI (ChatGPT, Claude, Gemini). En llms.txt gör sajten läsbar för AI-sök och är en enkel konkurrensfördel.",
        service: SERVICES.aiSearch,
      });
    }
    if (!seoChecks.sitemap) {
      findings.push({
        key: "missing_sitemap",
        severity: "medium",
        title: "Saknar sitemap.xml",
        description:
          "Utan sitemap riskerar Google att missa sidor vid indexering.",
        service: SERVICES.seo,
      });
    }
    if (!seoChecks.og_tags) {
      findings.push({
        key: "missing_og_tags",
        severity: "low",
        title: "Saknar Open Graph-taggar",
        description:
          "Länkar som delas på Facebook/LinkedIn visas utan bild och beskrivning — ser oprofessionellt ut.",
        service: SERVICES.content,
      });
    }
    if (!seoChecks.h1) {
      findings.push({
        key: "missing_h1",
        severity: "low",
        title: "Saknar H1-rubrik",
        description: "Startsidan saknar huvudrubrik (H1), en SEO-grundsten.",
        service: SERVICES.seo,
      });
    }
  }

  // --- Google Business-profil ---
  if (businessProfile) {
    if (!businessProfile.found) {
      findings.push({
        key: "missing_business_profile",
        severity: "high",
        title: "Saknar Google Business-profil",
        description:
          "Företaget syns inte på Google Maps eller i lokala sökresultat — där de flesta lokala kunder letar. En Business-profil ger direkt fler söktraffär.",
        service: SERVICES.business,
      });
    } else {
      if (
        businessProfile.reviews_count != null &&
        businessProfile.reviews_count < 5
      ) {
        findings.push({
          key: "few_reviews",
          severity: "medium",
          title: `Få Google-recensioner (${businessProfile.reviews_count} st)`,
          description:
            "Recensioner är en av de starkaste lokala rankingfaktorerna och avgörande för förtroendet. Ett strukturerat sätt att be nöjda kunder om omdömen ger snabb effekt.",
          service: SERVICES.business,
        });
      }
      if (businessProfile.rating != null && businessProfile.rating < 4) {
        findings.push({
          key: "low_rating",
          severity: "medium",
          title: `Lågt Google-betyg (${businessProfile.rating.toLocaleString("sv-SE")})`,
          description:
            "Betyg under 4,0 påverkar både klick och förtroende negativt.",
          service: SERVICES.business,
        });
      }
    }
  }

  // --- Search Console (endast när åtkomst finns) ---
  if (searchConsole) {
    if (searchConsole.clicks === 0 && searchConsole.impressions > 0) {
      findings.push({
        key: "no_clicks",
        severity: "high",
        title: "Inga klick från Google senaste 28 dagarna",
        description: `Sajten visades ${searchConsole.impressions.toLocaleString("sv-SE")} gånger i sökresultaten utan ett enda klick — synlighet finns men positionen eller texten konverterar inte.`,
        service: SERVICES.seo,
      });
    } else if (searchConsole.position > 10) {
      findings.push({
        key: "low_position",
        severity: "medium",
        title: `Snittposition ${searchConsole.position.toLocaleString("sv-SE", { maximumFractionDigits: 1 })} i Google`,
        description:
          "Sajten hamnar i snitt utanför första sidan. Position 1–10 får ~90 % av alla klick.",
        service: SERVICES.seo,
      });
    }
  }

  const severityOrder: Record<FindingSeverity, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  return findings.sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
  );
}
