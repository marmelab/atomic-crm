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
              <div className="flex flex-col gap-0.5">
                <p>
                  {gsc.clicks.toLocaleString("sv-SE")} klick ·{" "}
                  {gsc.impressions.toLocaleString("sv-SE")} visningar (28 dgr)
                </p>
                <p className="text-muted-foreground">
                  Snittposition{" "}
                  {gsc.position.toLocaleString("sv-SE", {
                    maximumFractionDigits: 1,
                  })}
                </p>
                {gsc.top_queries.length > 0 ? (
                  <p className="text-xs text-muted-foreground truncate">
                    Toppsökningar:{" "}
                    {gsc.top_queries.map((q) => q.query).join(", ")}
                  </p>
                ) : null}
              </div>
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
              Inga brister hittade — sajten ser bra ut! 🎉
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
