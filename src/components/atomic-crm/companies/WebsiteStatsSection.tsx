import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  Download,
  FileText,
  Gauge,
  Globe2,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Settings2,
} from "lucide-react";
import { useState } from "react";
import { useDataProvider, useGetList, useNotify } from "ra-core";

import type {
  Company,
  MonthlyReport,
  WebsiteFinding,
  WebsiteSnapshot,
} from "../types";
import { MonthlyReportModal } from "./MonthlyReportModal";
import { VisibilityMetricCard } from "./visibility/VisibilityMetricCard";
import { VisibilityStatusCard } from "./visibility/VisibilityStatusCard";
import { VisibilityTrendChart } from "./visibility/VisibilityTrendChart";
import type { VisibilityDataProvider } from "./visibility/types";

const REPORT_STATUS_STYLES: Record<MonthlyReport["status"], string> = {
  draft: "bg-sky-100 text-sky-800 border-sky-200",
  approved: "bg-amber-100 text-amber-800 border-amber-200",
  sent: "bg-green-100 text-green-800 border-green-200",
  failed: "bg-red-100 text-red-800 border-red-200",
  skipped: "bg-muted text-muted-foreground",
};

const REPORT_STATUS_LABELS: Record<MonthlyReport["status"], string> = {
  draft: "Utkast",
  approved: "Godkänd",
  sent: "Skickad",
  failed: "Misslyckad",
  skipped: "Hoppad",
};

const SEVERITY_STYLES: Record<WebsiteFinding["severity"], string> = {
  high: "bg-red-50 text-red-900 border-red-200",
  medium: "bg-amber-50 text-amber-900 border-amber-200",
  low: "bg-sky-50 text-sky-900 border-sky-200",
};

const SEVERITY_LABELS: Record<WebsiteFinding["severity"], string> = {
  high: "Hög prioritet",
  medium: "Medel",
  low: "Låg",
};

const SOURCE_LABELS: Record<string, string> = {
  pagespeed: "PageSpeed",
  seo_crawl: "Teknisk SEO",
  business_profile: "Google Business",
  search_console: "Search Console",
};

function formatDate(value?: string | null): string {
  if (!value) return "Okänd period";
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("sv-SE", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function periodLabel(snapshot: WebsiteSnapshot): string {
  if (snapshot.period_start && snapshot.period_end) {
    const kind =
      snapshot.window_kind === "calendar_month"
        ? "Officiell månad"
        : snapshot.window_kind === "rolling_28d"
          ? "Rullande 28 dagar"
          : "Äldre analys";
    return `${formatDate(snapshot.period_start)} · ${kind}`;
  }
  return `${new Date(snapshot.fetched_at).toLocaleDateString("sv-SE")} · äldre analys`;
}

function percentDelta(
  current?: number | null,
  previous?: number | null,
): number | null {
  if (
    typeof current !== "number" ||
    typeof previous !== "number" ||
    previous === 0
  ) {
    return null;
  }
  return ((current - previous) / previous) * 100;
}

function trendText(delta: number | null, lowerIsBetter = false): string {
  if (delta == null) return "Ingen jämförbar föregående period";
  if (Math.abs(delta) < 0.5) return "Oförändrat mot föregående period";
  const improved = lowerIsBetter ? delta < 0 : delta > 0;
  return `${improved ? "Förbättring" : "Försämring"} ${Math.abs(Math.round(delta))} %`;
}

function sourceStatus(
  snapshot: WebsiteSnapshot,
  key: string,
): "available" | "unavailable" | "error" {
  return (
    snapshot.source_status?.[key]?.status ??
    (key === "search_console" && snapshot.search_console
      ? "available"
      : key === "pagespeed" && snapshot.pagespeed
        ? "available"
        : key === "seo_crawl" && snapshot.seo_checks
          ? "available"
          : key === "business_profile" && snapshot.business_profile
            ? "available"
            : "unavailable")
  );
}

export function WebsiteStatsSection({ company }: { company: Company }) {
  const dataProvider = useDataProvider<VisibilityDataProvider>();
  const notify = useNotify();
  const [analyzing, setAnalyzing] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>();
  const [selectedReportId, setSelectedReportId] = useState<number>();

  const { data: snapshots, refetch } = useGetList<WebsiteSnapshot>(
    "website_snapshots",
    {
      pagination: { page: 1, perPage: 24 },
      sort: { field: "fetched_at", order: "DESC" },
      filter: { company_id: company.id },
    },
  );
  const { data: reports, refetch: refetchReports } = useGetList<MonthlyReport>(
    "monthly_reports",
    {
      pagination: { page: 1, perPage: 12 },
      sort: { field: "period", order: "DESC" },
      filter: { company_id: company.id },
    },
  );

  const selected =
    snapshots?.find((snapshot) => String(snapshot.id) === selectedSnapshotId) ??
    snapshots?.[0];
  const comparison = selected
    ? snapshots?.find(
        (snapshot) =>
          snapshot.id !== selected.id &&
          snapshot.window_kind === selected.window_kind &&
          (selected.period_start && snapshot.period_start
            ? snapshot.period_start < selected.period_start
            : snapshot.fetched_at < selected.fetched_at),
      )
    : undefined;
  const officialHistory = (snapshots ?? [])
    .filter(
      (snapshot) =>
        snapshot.window_kind === "calendar_month" && snapshot.period_start,
    )
    .sort((a, b) => (a.period_start ?? "").localeCompare(b.period_start ?? ""));

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const result = await dataProvider.analyzeWebsite(company.id, {
        window_kind: "rolling_28d",
      });
      await refetch();
      setSelectedSnapshotId(String(result.snapshot_id));
      notify("Den rullande 28-dagarsanalysen är uppdaterad", {
        type: "success",
      });
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Kunde inte analysera hemsidan",
        { type: "warning" },
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const openNewReport = () => {
    setSelectedReportId(undefined);
    setReportOpen(true);
  };

  const openExistingReport = (reportId: number) => {
    setSelectedReportId(reportId);
    setReportOpen(true);
  };

  const downloadPdf = async (reportId: number) => {
    try {
      const result = await dataProvider.getMonthlyReportPdf(reportId);
      window.open(result.signed_url, "_blank", "noopener,noreferrer");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Kunde inte öppna PDF:en",
        { type: "warning" },
      );
    }
  };

  if (!selected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="size-4" />
            Samlad synlighetsvy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            Ingen analys finns ännu. Kör den första analysen för att samla
            söksynlighet, sidupplevelse, lokal synlighet och teknisk grund.
          </p>
          <Button onClick={handleAnalyze} disabled={analyzing}>
            {analyzing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            {analyzing ? "Analyserar…" : "Kör första analysen"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const gsc = selected.search_console;
  const previousGsc = comparison?.search_console;
  const ctr =
    gsc?.ctr != null
      ? gsc.ctr * 100
      : gsc && gsc.impressions > 0
        ? (gsc.clicks / gsc.impressions) * 100
        : null;
  const previousCtr =
    previousGsc?.ctr != null
      ? previousGsc.ctr * 100
      : previousGsc && previousGsc.impressions > 0
        ? (previousGsc.clicks / previousGsc.impressions) * 100
        : null;
  const clickDelta = percentDelta(gsc?.clicks, previousGsc?.clicks);
  const impressionDelta = percentDelta(
    gsc?.impressions,
    previousGsc?.impressions,
  );
  const ctrDelta = percentDelta(ctr, previousCtr);
  const positionDelta =
    gsc && previousGsc ? gsc.position - previousGsc.position : null;
  const coverageAvailable =
    selected.data_coverage?.available_sources ??
    ["pagespeed", "seo_crawl", "business_profile", "search_console"].filter(
      (key) => sourceStatus(selected, key) === "available",
    ).length;
  const missingSources = [
    "pagespeed",
    "seo_crawl",
    "business_profile",
    "search_console",
  ].filter((key) => sourceStatus(selected, key) !== "available");

  const googleStatus = !gsc
    ? "missing"
    : gsc.impressions === 0 || gsc.position > 20
      ? "poor"
      : gsc.position > 10 || (gsc.impressions >= 50 && (ctr ?? 0) < 2)
        ? "attention"
        : "good";
  const pageStatus =
    selected.field_data?.lcp_rating === "POOR" ||
    selected.field_data?.inp_rating === "POOR" ||
    selected.field_data?.cls_rating === "POOR" ||
    (selected.performance_score != null && selected.performance_score < 50)
      ? "poor"
      : selected.field_data?.lcp_rating === "NEEDS_IMPROVEMENT" ||
          selected.field_data?.inp_rating === "NEEDS_IMPROVEMENT" ||
          selected.field_data?.cls_rating === "NEEDS_IMPROVEMENT" ||
          (selected.performance_score != null &&
            selected.performance_score < 80)
        ? "attention"
        : selected.field_data || selected.performance_score != null
          ? "good"
          : "missing";
  const business = selected.business_profile;
  const localStatus = !business
    ? "missing"
    : !business.found
      ? "poor"
      : (business.reviews_count ?? 0) < 5 || (business.rating ?? 5) < 4
        ? "attention"
        : "good";
  const technicalValues = selected.seo_checks
    ? [
        selected.seo_checks.indexable !== false,
        Boolean(selected.seo_checks.title),
        Boolean(selected.seo_checks.meta_description),
        Boolean(selected.seo_checks.h1),
        Boolean(selected.seo_checks.sitemap),
        Boolean(selected.seo_checks.robots),
        Boolean(selected.seo_checks.schema_org),
        Boolean(selected.seo_checks.og_tags),
      ]
    : [];
  const failedTechnical = technicalValues.filter((value) => !value).length;
  const technicalStatus =
    technicalValues.length === 0
      ? "missing"
      : failedTechnical >= 3
        ? "poor"
        : failedTechnical > 0
          ? "attention"
          : "good";
  const primaryFinding = selected.findings.find(
    (finding) => finding.key !== "missing_llms_txt",
  );

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="size-5" />
              Samlad synlighetsvy
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Förstå nuläget, varför det spelar roll och vad Axona bör göra
              härnäst.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={openNewReport}>
              <FileText className="size-4" />
              Skapa kundrapport
            </Button>
            <Button
              variant="outline"
              onClick={handleAnalyze}
              disabled={analyzing}
            >
              {analyzing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              {analyzing ? "Analyserar…" : "Uppdatera 28 dagar"}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={String(selected.id)}
            onValueChange={setSelectedSnapshotId}
          >
            <SelectTrigger className="w-[260px]">
              <SelectValue aria-label={periodLabel(selected)} />
            </SelectTrigger>
            <SelectContent>
              {(snapshots ?? []).map((snapshot) => (
                <SelectItem key={snapshot.id} value={String(snapshot.id)}>
                  {periodLabel(snapshot)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="outline">{coverageAvailable}/4 datakällor</Badge>
          <span className="text-xs text-muted-foreground">
            Analyserad {new Date(selected.fetched_at).toLocaleString("sv-SE")}
          </span>
        </div>
      </CardHeader>

      <CardContent>
        {missingSources.length > 0 ? (
          <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">Analysen är delvis komplett</p>
            <p className="mt-1 text-xs">
              Saknade källor:{" "}
              {missingSources.map((key) => SOURCE_LABELS[key]).join(", ")}.
              Saknad data visas aldrig som noll eller godkänt.
            </p>
          </div>
        ) : null}

        <Tabs defaultValue="overview">
          <TabsList className="grid h-auto w-full grid-cols-2 md:grid-cols-4">
            <TabsTrigger value="overview">Översikt</TabsTrigger>
            <TabsTrigger value="google">Google & sökord</TabsTrigger>
            <TabsTrigger value="quality">Sajtens kvalitet</TabsTrigger>
            <TabsTrigger value="reports">Rapporter</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-5 space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <VisibilityStatusCard
                title="Google-synlighet"
                status={googleStatus}
                detail={
                  gsc
                    ? `${gsc.clicks.toLocaleString("sv-SE")} klick och snittposition ${gsc.position.toFixed(1)}`
                    : "Search Console kunde inte läsas."
                }
                icon={<Search className="size-4" />}
              />
              <VisibilityStatusCard
                title="Sidupplevelse"
                status={pageStatus}
                detail={
                  selected.field_data
                    ? "Bedömd med verklig besöksdata."
                    : "Bedömd med Lighthouse-labbtest när fältdata saknas."
                }
                icon={<Gauge className="size-4" />}
              />
              <VisibilityStatusCard
                title="Lokal synlighet"
                status={localStatus}
                detail={
                  business?.found
                    ? `${business.rating ?? "—"} i betyg · ${business.reviews_count ?? 0} recensioner`
                    : business
                      ? "Ingen verifierad Google Business-profil."
                      : "Google Business kunde inte kontrolleras."
                }
                icon={<MapPin className="size-4" />}
              />
              <VisibilityStatusCard
                title="Teknisk grund"
                status={technicalStatus}
                detail={
                  technicalValues.length
                    ? `${technicalValues.length - failedTechnical} av ${technicalValues.length} grundkontroller godkända.`
                    : "Den tekniska crawlen saknas."
                }
                icon={<Settings2 className="size-4" />}
              />
            </div>

            <div className="rounded-lg border bg-muted/20 p-4">
              <p className="text-sm font-semibold">Viktigaste nästa steg</p>
              {primaryFinding ? (
                <>
                  <p className="mt-2 font-medium">{primaryFinding.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {primaryFinding.description}
                  </p>
                  <Badge className="mt-3" variant="outline">
                    Rekommenderad insats: {primaryFinding.service}
                  </Badge>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  Inga kritiska brister hittades i tillgängliga datakällor.
                </p>
              )}
            </div>

            <div>
              <h3 className="mb-3 font-semibold">Prioriterad åtgärdsplan</h3>
              <div className="space-y-3">
                {selected.findings
                  .filter((finding) => finding.key !== "missing_llms_txt")
                  .map((finding, index) => (
                    <div
                      key={finding.key}
                      className={`rounded-lg border p-4 ${SEVERITY_STYLES[finding.severity]}`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">
                          {index + 1}. {finding.title}
                        </span>
                        <Badge variant="outline" className="bg-white/60">
                          {SEVERITY_LABELS[finding.severity]}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="ml-auto bg-white/60"
                        >
                          {finding.service}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm">{finding.description}</p>
                    </div>
                  ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="google" className="mt-5 space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <VisibilityMetricCard
                label="Klick från Google"
                value={gsc?.clicks.toLocaleString("sv-SE") ?? "Saknas"}
                trend={trendText(clickDelta)}
                explanation={{
                  meaning:
                    "Antal besök där någon klickade från Googles organiska sökresultat.",
                  impact:
                    "Detta är den tydligaste kopplingen mellan söksynlighet och potentiella kunder.",
                  thresholds:
                    "Ingen universell bra nivå finns; stabil tillväxt och relevanta sökord är viktigast.",
                  interpretation: trendText(clickDelta),
                  action:
                    "Stärk sidor och sökord som redan får visningar men ännu få klick.",
                }}
              />
              <VisibilityMetricCard
                label="Visningar"
                value={gsc?.impressions.toLocaleString("sv-SE") ?? "Saknas"}
                trend={trendText(impressionDelta)}
                explanation={{
                  meaning:
                    "Hur många gånger sajten förekom i Googles sökresultat.",
                  impact:
                    "Visningar visar räckvidd, även när användaren inte klickar.",
                  thresholds:
                    "Bedöm trend och relevans. Ett plötsligt fall kräver kontroll av indexering och innehåll.",
                  interpretation: trendText(impressionDelta),
                  action:
                    "Skapa eller förbättra innehåll för tjänster och frågor där kunden vill synas.",
                }}
              />
              <VisibilityMetricCard
                label="Klickfrekvens"
                value={
                  ctr == null
                    ? "Saknas"
                    : `${ctr.toLocaleString("sv-SE", { maximumFractionDigits: 1 })} %`
                }
                trend={trendText(ctrDelta)}
                explanation={{
                  meaning:
                    "Andelen visningar som blev ett klick till webbplatsen.",
                  impact:
                    "Visar om sökresultatets titel och beskrivning lockar rätt personer.",
                  thresholds:
                    "Bedöms tillsammans med position och sökintention. Under 2 % vid många visningar är en tydlig möjlighet.",
                  interpretation: trendText(ctrDelta),
                  action:
                    "Skriv om sidtitel och metabeskrivning på sidor med många visningar men låg klickfrekvens.",
                }}
              />
              <VisibilityMetricCard
                label="Snittposition"
                value={
                  gsc
                    ? gsc.position.toLocaleString("sv-SE", {
                        maximumFractionDigits: 1,
                      })
                    : "Saknas"
                }
                trend={
                  positionDelta == null
                    ? "Ingen jämförbar föregående period"
                    : `${positionDelta < 0 ? "Förbättring" : "Försämring"} ${Math.abs(positionDelta).toFixed(1)} platser`
                }
                explanation={{
                  meaning:
                    "Genomsnittlig placering för alla sökningar där sajten visades. Lägre tal är bättre.",
                  impact:
                    "Position 1–10 är första sidan; 11–20 är ofta den bästa snabba förbättringsmöjligheten.",
                  thresholds:
                    "1–3 starkt, 4–10 första sidan, 11–20 nära första sidan, över 20 svag synlighet.",
                  interpretation:
                    positionDelta == null
                      ? "Ingen jämförelse finns ännu."
                      : positionDelta < 0
                        ? "Placeringen har förbättrats."
                        : "Placeringen har försämrats.",
                  action:
                    "Prioritera relevanta sökord på position 4–20 med bättre innehåll och interna länkar.",
                }}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Klicktrend · officiella kalendermånader
                </CardTitle>
              </CardHeader>
              <CardContent>
                <VisibilityTrendChart
                  label="Klick från Google"
                  points={officialHistory.map((snapshot) => ({
                    label: formatDate(snapshot.period_start),
                    value: snapshot.search_console?.clicks ?? null,
                  }))}
                />
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Sökord som driver trafik
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {gsc?.top_queries.length ? (
                    <div className="space-y-2">
                      {gsc.top_queries.slice(0, 10).map((query) => (
                        <div
                          key={query.query}
                          className="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-0"
                        >
                          <span className="truncate">{query.query}</span>
                          <span className="whitespace-nowrap text-xs text-muted-foreground">
                            {query.clicks} klick · pos{" "}
                            {query.position.toFixed(1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Ingen sökordsdata för perioden.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Sökord med störst potential
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {gsc?.opportunities?.length ? (
                    <div className="space-y-3">
                      {gsc.opportunities.slice(0, 8).map((item) => (
                        <div
                          key={`${item.kind}-${item.query}`}
                          className="rounded-md border p-3 text-sm"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{item.query}</span>
                            <Badge variant="outline">
                              {item.kind === "low_ctr"
                                ? "Låg klickfrekvens"
                                : item.kind === "position_4_10"
                                  ? "Första sidan"
                                  : "Nära första sidan"}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {item.impressions.toLocaleString("sv-SE")} visningar
                            · position {item.position.toFixed(1)} ·{" "}
                            {(item.ctr * 100).toFixed(1)} % klickfrekvens
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Inga tydliga sökordsmöjligheter identifierades.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Landningssidor från Google
                </CardTitle>
              </CardHeader>
              <CardContent>
                {gsc?.top_pages?.length ? (
                  <div className="space-y-2">
                    {gsc.top_pages.map((item) => (
                      <div
                        key={item.page}
                        className="grid gap-1 border-b py-2 text-sm last:border-0 md:grid-cols-[1fr_auto]"
                      >
                        <span className="truncate" title={item.page}>
                          {item.page}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {item.clicks} klick ·{" "}
                          {item.impressions.toLocaleString("sv-SE")} visningar
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Ingen siddata för perioden.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="quality" className="mt-5 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Gauge className="size-4" />
                  Sidupplevelse
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
                  Verklig besöksdata visas som Core Web Vitals när Google har
                  tillräckligt underlag. Lighthouse-poängen är ett separat
                  labbtest. TBT visas aldrig som om det vore INP.
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <VisibilityMetricCard
                    label="Verklig LCP"
                    value={
                      selected.field_data?.lcp_ms == null
                        ? "Fältdata saknas"
                        : `${(selected.field_data.lcp_ms / 1000).toFixed(1)} s`
                    }
                    trend="75:e percentilen av verkliga besök"
                    explanation={{
                      meaning:
                        "Hur snabbt sidans största synliga innehåll laddas för verkliga besökare.",
                      impact:
                        "Lång väntan ökar avhopp och försämrar användarupplevelsen.",
                      thresholds:
                        "Bra under 2,5 s, förbättras 2,5–4,0 s, dåligt över 4,0 s.",
                      interpretation:
                        selected.field_data?.lcp_ms == null
                          ? "Google har inte tillräcklig fältdata."
                          : selected.field_data.lcp_ms <= 2500
                            ? "Laddningen är bra."
                            : "Laddningen bör förbättras.",
                      action:
                        "Optimera största bilden, typsnitt och kritiska resurser.",
                    }}
                  />
                  <VisibilityMetricCard
                    label="Verklig INP"
                    value={
                      selected.field_data?.inp_ms == null
                        ? "Fältdata saknas"
                        : `${Math.round(selected.field_data.inp_ms)} ms`
                    }
                    trend="Respons på klick och interaktion"
                    explanation={{
                      meaning:
                        "Hur snabbt sidan visuellt svarar efter en användarinteraktion.",
                      impact:
                        "Trög respons får formulär, menyer och knappar att kännas trasiga.",
                      thresholds:
                        "Bra under 200 ms, förbättras 200–500 ms, dåligt över 500 ms.",
                      interpretation:
                        selected.field_data?.inp_ms == null
                          ? "Google har inte tillräcklig fältdata."
                          : selected.field_data.inp_ms <= 200
                            ? "Responsen är bra."
                            : "Responsen bör förbättras.",
                      action:
                        "Minska tung JavaScript och dela upp långa uppgifter på huvudtråden.",
                    }}
                  />
                  <VisibilityMetricCard
                    label="Verklig CLS"
                    value={
                      selected.field_data?.cls == null
                        ? "Fältdata saknas"
                        : selected.field_data.cls.toFixed(2)
                    }
                    trend="Layoutstabilitet för verkliga besök"
                    explanation={{
                      meaning:
                        "Hur mycket innehållet hoppar medan sidan laddas.",
                      impact:
                        "Oväntade hopp leder till felklick och minskat förtroende.",
                      thresholds:
                        "Bra under 0,10, förbättras 0,10–0,25, dåligt över 0,25.",
                      interpretation:
                        selected.field_data?.cls == null
                          ? "Google har inte tillräcklig fältdata."
                          : selected.field_data.cls <= 0.1
                            ? "Layouten är stabil."
                            : "Layouten behöver stabiliseras.",
                      action:
                        "Sätt fasta dimensioner på bilder, embeds och dynamiskt innehåll.",
                    }}
                  />
                  <VisibilityMetricCard
                    label="Lighthouse prestanda"
                    value={selected.performance_score?.toString() ?? "Saknas"}
                    trend="Syntetiskt mobiltest · 0–100"
                    explanation={{
                      meaning:
                        "Ett kontrollerat labbtest som hjälper oss hitta tekniska flaskhalsar.",
                      impact:
                        "Bra för diagnos, men ersätter inte hur verkliga besökare upplever sidan.",
                      thresholds:
                        "80–100 bra, 50–79 förbättras, under 50 dåligt.",
                      interpretation:
                        selected.performance_score == null
                          ? "Testet kunde inte köras."
                          : selected.performance_score >= 80
                            ? "Labbtestet ser bra ut."
                            : "Labbtestet visar förbättringsbehov.",
                      action:
                        "Använd Lighthouse-förslagen för att prioritera bilder, skript och rendering.",
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Globe2 className="size-4" />
                    Teknisk grund
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    ["Indexerbar", selected.seo_checks?.indexable !== false],
                    ["Sidtitel", Boolean(selected.seo_checks?.title)],
                    [
                      "Metabeskrivning",
                      Boolean(selected.seo_checks?.meta_description),
                    ],
                    ["Huvudrubrik", Boolean(selected.seo_checks?.h1)],
                    ["Sitemap", Boolean(selected.seo_checks?.sitemap)],
                    ["Robots.txt", Boolean(selected.seo_checks?.robots)],
                    [
                      "Strukturerad data",
                      Boolean(selected.seo_checks?.schema_org),
                    ],
                    ["Delningsmetadata", Boolean(selected.seo_checks?.og_tags)],
                  ].map(([label, passed]) => (
                    <div
                      key={String(label)}
                      className="flex items-center justify-between border-b py-2 text-sm last:border-0"
                    >
                      <span>{label}</span>
                      {selected.seo_checks ? (
                        passed ? (
                          <Badge className="bg-green-100 text-green-800">
                            Finns
                          </Badge>
                        ) : (
                          <Badge variant="destructive">Saknas</Badge>
                        )
                      ) : (
                        <Badge variant="outline">Ej kontrollerad</Badge>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MapPin className="size-4" />
                    Lokal synlighet
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  {!business ? (
                    <p className="text-muted-foreground">
                      Google Business kunde inte kontrolleras.
                    </p>
                  ) : business.found ? (
                    <>
                      <p className="text-3xl font-semibold tabular-nums">
                        {business.rating?.toLocaleString("sv-SE") ?? "—"} / 5
                      </p>
                      <p className="text-muted-foreground">
                        {business.reviews_count ?? 0} recensioner
                      </p>
                      <p>
                        En jämn ström av nya recensioner stärker både lokal
                        synlighet och förtroende.
                      </p>
                    </>
                  ) : (
                    <p className="text-red-700">
                      Ingen verifierad profil hittades. Företaget riskerar att
                      inte synas på Google Maps.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="reports" className="mt-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">Kundrapporter</h3>
                <p className="text-sm text-muted-foreground">
                  HTML-mejl och privat PDF från samma verifierade rapportdata.
                </p>
              </div>
              <Button onClick={openNewReport}>
                <FileText className="size-4" />
                Ny rapport
              </Button>
            </div>
            {reports?.length ? (
              <div className="space-y-2">
                {reports.map((report) => (
                  <div
                    key={report.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
                  >
                    <button
                      type="button"
                      onClick={() => openExistingReport(Number(report.id))}
                      className="text-left"
                    >
                      <p className="font-medium">
                        {new Date(
                          `${report.period}T00:00:00Z`,
                        ).toLocaleDateString("sv-SE", {
                          month: "long",
                          year: "numeric",
                          timeZone: "UTC",
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {report.sent_at
                          ? `Skickad till ${report.recipient_email ?? "—"}`
                          : report.error
                            ? report.error
                            : `${report.view_model?.coverage.available ?? "—"}/${report.view_model?.coverage.total ?? "—"} datakällor`}
                      </p>
                    </button>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={REPORT_STATUS_STYLES[report.status]}
                      >
                        {REPORT_STATUS_LABELS[report.status]}
                      </Badge>
                      {report.pdf_storage_path ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => downloadPdf(Number(report.id))}
                          aria-label="Ladda ner PDF"
                        >
                          <Download className="size-4" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Inga rapporter skapade ännu.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      <MonthlyReportModal
        company={company}
        reportId={selectedReportId}
        open={reportOpen}
        onOpenChange={setReportOpen}
        onSent={() => refetchReports()}
      />
    </Card>
  );
}
