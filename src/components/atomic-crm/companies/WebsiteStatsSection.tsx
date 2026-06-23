import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChartLine,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { useDataProvider, useGetList, useNotify } from "ra-core";

import type { CrmDataProvider } from "../providers/types";
import type { Company, WebsiteFinding, WebsiteSnapshot } from "../types";

/**
 * Hemsidestatistik på Kund-fliken (Fas 2 av kundregistret):
 * PageSpeed-poäng, Core Web Vitals, Google Business-profil, Search
 * Console-data (när åtkomst finns) och brist-analysen "Brister & möjligheter"
 * — säljunderlaget för merförsäljning.
 */

const SEVERITY_STYLES: Record<WebsiteFinding["severity"], string> = {
  high: "bg-red-100 text-red-800 border-red-200",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  low: "bg-sky-100 text-sky-800 border-sky-200",
};

const SEVERITY_LABELS: Record<WebsiteFinding["severity"], string> = {
  high: "Hög",
  medium: "Medel",
  low: "Låg",
};

function scoreColor(score: number): string {
  if (score >= 80) return "bg-green-100 text-green-800 border-green-200";
  if (score >= 50) return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-red-100 text-red-800 border-red-200";
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("sv-SE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const ScoreBadge = ({
  label,
  score,
  previous,
}: {
  label: string;
  score?: number | null;
  previous?: number | null;
}) => {
  if (score == null) return null;
  const delta = previous != null ? score - previous : null;
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className={`inline-flex h-14 w-14 items-center justify-center rounded-full border text-lg font-bold ${scoreColor(score)}`}
      >
        {score}
      </span>
      <span className="text-xs text-muted-foreground flex items-center gap-0.5">
        {label}
        {delta != null && delta !== 0 ? (
          delta > 0 ? (
            <ArrowUpRight className="w-3 h-3 text-green-600" />
          ) : (
            <ArrowDownRight className="w-3 h-3 text-red-600" />
          )
        ) : null}
      </span>
    </div>
  );
};

const GscStat = ({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) => (
  <div className="flex flex-col" title={hint}>
    <span className="text-base font-semibold leading-tight text-foreground">
      {value}
    </span>
    <span className="text-[11px] text-muted-foreground">{label}</span>
  </div>
);

export const WebsiteStatsSection = ({ company }: { company: Company }) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const [analyzing, setAnalyzing] = useState(false);

  const { data: snapshots, refetch } = useGetList<WebsiteSnapshot>(
    "website_snapshots",
    {
      pagination: { page: 1, perPage: 2 },
      sort: { field: "fetched_at", order: "DESC" },
      filter: { company_id: company.id },
    },
  );

  const latest = snapshots?.[0];
  const previous = snapshots?.[1];

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      await dataProvider.analyzeWebsite(company.id);
      await refetch();
      notify("Hemsidesanalysen är klar", { type: "info" });
    } catch (error) {
      console.error("Website analysis failed:", error);
      notify("Kunde inte analysera hemsidan", { type: "warning" });
    } finally {
      setAnalyzing(false);
    }
  };

  const analyzeButton = (
    <Button
      variant="outline"
      size="sm"
      onClick={handleAnalyze}
      disabled={analyzing}
    >
      {analyzing ? (
        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
      ) : (
        <RefreshCw className="w-4 h-4 mr-1" />
      )}
      {analyzing ? "Analyserar (~30 s)..." : "Uppdatera statistik"}
    </Button>
  );

  if (!latest) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ChartLine className="w-4 h-4" />
            Hemsidestatistik
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p className="text-muted-foreground">
            Ingen analys gjord ännu. Analysen hämtar PageSpeed-poäng, SEO- och
            AI-sök-status, Google Business-profil och Search Console-data (när
            åtkomst finns).
          </p>
          <div>{analyzeButton}</div>
        </CardContent>
      </Card>
    );
  }

  const gsc = latest.search_console;
  const business = latest.business_profile;

  // Källor som inte kunde analyseras (saknad nyckel eller fel) — ska synas,
  // annars ser "0 brister" ut som ett friskt betyg när analysen var partiell.
  const inactiveSources = [
    latest.performance_score == null && latest.pagespeed == null
      ? "Prestanda/SEO-poäng (PageSpeed)"
      : null,
    latest.seo_checks == null ? "SEO/AI-sök-genomgång" : null,
    business == null ? "Google Business-profil" : null,
  ].filter(Boolean) as string[];
  const analysisComplete = inactiveSources.length === 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ChartLine className="w-4 h-4" />
            Hemsidestatistik
          </CardTitle>
          {analyzeButton}
        </div>
        <p className="text-xs text-muted-foreground">
          Senast uppdaterad {formatDateTime(latest.fetched_at)} ·{" "}
          {latest.source === "cron" ? "automatiskt" : "manuellt"} · {latest.url}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {inactiveSources.length > 0 ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
            ⚠️ Ofullständig analys — kunde inte kontrollera:{" "}
            {inactiveSources.join(", ")}. Brist-listan nedan täcker bara de
            källor som gick att analysera.
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-6">
          <ScoreBadge
            label="Prestanda"
            score={latest.performance_score}
            previous={previous?.performance_score}
          />
          <ScoreBadge
            label="SEO"
            score={latest.seo_score}
            previous={previous?.seo_score}
          />
          {latest.pagespeed?.lcp_ms != null ? (
            <div className="text-xs text-muted-foreground">
              <p>
                Laddtid (LCP):{" "}
                <span className="font-medium text-foreground">
                  {(latest.pagespeed.lcp_ms / 1000).toLocaleString("sv-SE", {
                    maximumFractionDigits: 1,
                  })}{" "}
                  s
                </span>
              </p>
              {latest.pagespeed.cls != null ? (
                <p>
                  Layoutstabilitet (CLS):{" "}
                  <span className="font-medium text-foreground">
                    {latest.pagespeed.cls.toLocaleString("sv-SE", {
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border p-3">
            <p className="font-medium mb-1">Google Business-profil</p>
            {business == null ? (
              <p className="text-muted-foreground">Kunde inte kontrolleras.</p>
            ) : business.found ? (
              <p>
                ⭐ {business.rating?.toLocaleString("sv-SE") ?? "—"} ·{" "}
                {business.reviews_count ?? 0} recensioner
              </p>
            ) : (
              <p className="text-red-700">Saknas — syns inte på Google Maps.</p>
            )}
          </div>

          <div className="rounded-md border p-3">
            <p className="font-medium mb-1">Google Search Console</p>
            {gsc ? (
              gsc.clicks === 0 && gsc.impressions === 0 ? (
                <p className="text-red-700">
                  Inga visningar i Google-sök senaste 28 dagarna — sajten är i
                  praktiken osynlig för sökande kunder.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <GscStat
                      label="Klick"
                      value={gsc.clicks.toLocaleString("sv-SE")}
                      hint="Antal personer som klickade in på sajten från Google"
                    />
                    <GscStat
                      label="Visningar"
                      value={gsc.impressions.toLocaleString("sv-SE")}
                      hint="Antal gånger sajten visades i Googles sökresultat"
                    />
                    <GscStat
                      label="CTR"
                      value={`${
                        gsc.impressions > 0
                          ? (
                              (gsc.clicks / gsc.impressions) *
                              100
                            ).toLocaleString("sv-SE", {
                              maximumFractionDigits: 1,
                            })
                          : "0"
                      } %`}
                      hint="Klickfrekvens: andel visningar som blev klick"
                    />
                    <GscStat
                      label="Snittposition"
                      value={gsc.position.toLocaleString("sv-SE", {
                        maximumFractionDigits: 1,
                      })}
                      hint="Genomsnittlig placering i sökresultatet — lägre är bättre (1 = överst)"
                    />
                  </div>
                  {gsc.top_queries.length > 0 ? (
                    <div>
                      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Toppsökningar
                      </p>
                      <ul className="flex flex-col gap-1">
                        {gsc.top_queries.map((q) => (
                          <li
                            key={q.query}
                            className="flex items-baseline justify-between gap-2 text-xs"
                          >
                            <span className="truncate" title={q.query}>
                              {q.query}
                            </span>
                            <span className="whitespace-nowrap text-muted-foreground">
                              {q.clicks.toLocaleString("sv-SE")} klick · pos{" "}
                              {q.position.toLocaleString("sv-SE", {
                                maximumFractionDigits: 1,
                              })}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <p className="text-[11px] text-muted-foreground">
                    Senaste 28 dagarna
                  </p>
                </div>
              )
            ) : (
              <p className="text-muted-foreground">
                Ingen åtkomst — lägg till service-kontot i kundens Search
                Console för sökdata.
              </p>
            )}
          </div>
        </div>

        <div>
          <p className="font-medium mb-2">
            Brister & möjligheter{" "}
            <span className="text-muted-foreground font-normal">
              ({latest.findings.length})
            </span>
          </p>
          {latest.findings.length === 0 ? (
            <p className="text-muted-foreground">
              {analysisComplete
                ? "Inga brister hittade i någon källa — sajten ser bra ut! 🎉"
                : "Inga brister i de källor som kunde analyseras — kör om analysen när alla källor är aktiva för en komplett bild."}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {latest.findings.map((finding) => (
                <div
                  key={finding.key}
                  className={`rounded-md border p-3 ${SEVERITY_STYLES[finding.severity]}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{finding.title}</span>
                    <Badge variant="outline" className="bg-white/60">
                      {SEVERITY_LABELS[finding.severity]}
                    </Badge>
                    <Badge variant="outline" className="bg-white/60 ml-auto">
                      💡 {finding.service}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs opacity-90">
                    {finding.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
