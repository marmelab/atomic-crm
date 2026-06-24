import {
  Activity,
  Download,
  ExternalLink,
  FileText,
  Gauge,
  Globe2,
  MapPin,
  RefreshCw,
  SearchCheck,
  Settings2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Link } from "react-router";

import type { CustomerVisibilityRow } from "../types";
import {
  CATEGORY_LABELS,
  categoryBadgeClass,
  dataBasisLabel,
  formatMetric,
  REPORT_STATUS_LABELS,
  reportBadgeClass,
} from "./customerVisibilityUi";

export function CustomerVisibilityDetailSheet({
  row,
  open,
  busyAction,
  onOpenChange,
  onAnalyze,
  onGenerateReport,
  onDownloadPdf,
}: {
  row: CustomerVisibilityRow | null;
  open: boolean;
  busyAction: string | null;
  onOpenChange: (open: boolean) => void;
  onAnalyze: (row: CustomerVisibilityRow) => void;
  onGenerateReport: (row: CustomerVisibilityRow) => void;
  onDownloadPdf: (row: CustomerVisibilityRow) => void;
}) {
  const snapshot = row?.currentSnapshot;
  const metrics = row?.viewModel?.metrics;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {row ? (
          <>
            <SheetHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={categoryBadgeClass(row.category)}>
                  {CATEGORY_LABELS[row.category]}
                </Badge>
                <Badge className={reportBadgeClass(row.reportStatus)}>
                  Rapport: {REPORT_STATUS_LABELS[row.reportStatus]}
                </Badge>
                <Badge variant="outline">{dataBasisLabel(row.dataBasis)}</Badge>
              </div>
              <SheetTitle>{row.companyName}</SheetTitle>
              <SheetDescription>
                Search Console följer vald period. Lighthouse, teknisk SEO och
                lokal synlighet använder den senaste verifierade analysen när
                månadens snapshot saknar dessa källor.
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-6 px-4 pb-6">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Varför denna kategori?</h3>
                {row.reasons.map((reason) => (
                  <div
                    key={reason.label}
                    className="flex items-start gap-2 text-sm"
                  >
                    <span
                      className={
                        reason.tone === "positive"
                          ? "mt-1.5 size-2 rounded-full bg-emerald-500"
                          : reason.tone === "negative"
                            ? "mt-1.5 size-2 rounded-full bg-red-500"
                            : "mt-1.5 size-2 rounded-full bg-slate-400"
                      }
                    />
                    <span>{reason.label}</span>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-3">
                <DetailMetric
                  icon={Globe2}
                  label="Google-klick"
                  value={formatMetric(metrics?.clicks, "number")}
                />
                <DetailMetric
                  icon={Activity}
                  label="Visningar"
                  value={formatMetric(metrics?.impressions, "number")}
                />
                <DetailMetric
                  icon={Activity}
                  label="CTR"
                  value={formatMetric(metrics?.ctr, "percent")}
                />
                <DetailMetric
                  icon={Activity}
                  label="Position"
                  value={formatMetric(metrics?.position, "decimal", true)}
                />
                <DetailMetric
                  icon={Gauge}
                  label="Prestanda"
                  value={
                    snapshot?.performance_score == null
                      ? "Saknas"
                      : `${snapshot.performance_score}/100`
                  }
                />
                <DetailMetric
                  icon={SearchCheck}
                  label="Lighthouse SEO"
                  value={
                    snapshot?.seo_score == null
                      ? "Saknas"
                      : `${snapshot.seo_score}/100`
                  }
                />
                <DetailMetric
                  icon={MapPin}
                  label="Google Business"
                  value={
                    snapshot?.business_profile?.rating == null
                      ? "Saknas"
                      : `${snapshot.business_profile.rating.toFixed(1)} · ${snapshot.business_profile.reviews_count ?? 0} recensioner`
                  }
                />
              </div>

              <div className="space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Globe2 className="size-4" />
                  Google-synlighet och möjligheter
                </h3>
                {snapshot?.search_console ? (
                  <div className="space-y-3">
                    {snapshot.search_console.top_queries.length > 0 ? (
                      <div>
                        <p className="mb-2 text-xs font-medium text-muted-foreground">
                          Trafikdrivande sökord
                        </p>
                        <div className="space-y-2">
                          {snapshot.search_console.top_queries
                            .slice(0, 3)
                            .map((query) => (
                              <div
                                key={query.query}
                                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                              >
                                <span className="truncate">{query.query}</span>
                                <span className="shrink-0 text-muted-foreground">
                                  {query.clicks} klick · plats{" "}
                                  {query.position.toFixed(1)}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    ) : null}
                    {snapshot.search_console.opportunities?.length ? (
                      <div>
                        <p className="mb-2 text-xs font-medium text-muted-foreground">
                          Sökordsmöjligheter
                        </p>
                        <div className="space-y-2">
                          {snapshot.search_console.opportunities
                            .slice(0, 3)
                            .map((opportunity) => (
                              <div
                                key={`${opportunity.kind}-${opportunity.query}`}
                                className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
                              >
                                <p className="font-medium">
                                  {opportunity.query}
                                </p>
                                <p className="mt-1 text-xs">
                                  {opportunity.impressions} visningar · CTR{" "}
                                  {(opportunity.ctr * 100).toFixed(1)} % · plats{" "}
                                  {opportunity.position.toFixed(1)}
                                </p>
                              </div>
                            ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                    Search Console saknas. Lighthouse, teknisk SEO och lokal
                    statistik nedan används fortfarande i bedömningen.
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold">
                  Lighthouse – labbmätning
                </h3>
                {snapshot?.pagespeed ? (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <LabMetric
                      label="LCP"
                      value={
                        snapshot.pagespeed.lcp_ms == null
                          ? "—"
                          : `${(snapshot.pagespeed.lcp_ms / 1000).toFixed(1)} s`
                      }
                    />
                    <LabMetric
                      label="CLS"
                      value={
                        snapshot.pagespeed.cls == null
                          ? "—"
                          : snapshot.pagespeed.cls.toFixed(2)
                      }
                    />
                    <LabMetric
                      label="TBT"
                      value={
                        snapshot.pagespeed.tbt_ms == null
                          ? "—"
                          : `${Math.round(snapshot.pagespeed.tbt_ms)} ms`
                      }
                    />
                    <LabMetric
                      label="FCP"
                      value={
                        snapshot.pagespeed.fcp_ms == null
                          ? "—"
                          : `${(snapshot.pagespeed.fcp_ms / 1000).toFixed(1)} s`
                      }
                    />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Lighthouse-data saknas för kunden.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  TBT är Lighthouse-labbdata och visas aldrig som verklig INP.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Sidupplevelse</h3>
                {snapshot?.field_data ? (
                  <div className="grid grid-cols-3 gap-2 text-center text-sm">
                    <CoreWebVital
                      label="LCP"
                      value={
                        snapshot.field_data.lcp_ms == null
                          ? "—"
                          : `${(snapshot.field_data.lcp_ms / 1000).toFixed(1)} s`
                      }
                      rating={snapshot.field_data.lcp_rating}
                    />
                    <CoreWebVital
                      label="INP"
                      value={
                        snapshot.field_data.inp_ms == null
                          ? "—"
                          : `${Math.round(snapshot.field_data.inp_ms)} ms`
                      }
                      rating={snapshot.field_data.inp_rating}
                    />
                    <CoreWebVital
                      label="CLS"
                      value={
                        snapshot.field_data.cls == null
                          ? "—"
                          : snapshot.field_data.cls.toFixed(2)
                      }
                      rating={snapshot.field_data.cls_rating}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Verklig Core Web Vitals-data saknas. Lighthouse-labbdata
                    visas inte som INP.
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Settings2 className="size-4" />
                  Teknisk grund
                </h3>
                {snapshot?.seo_checks ? (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {[
                      ["Indexerbar", snapshot.seo_checks.indexable !== false],
                      ["Sidtitel", Boolean(snapshot.seo_checks.title)],
                      [
                        "Metabeskrivning",
                        Boolean(snapshot.seo_checks.meta_description),
                      ],
                      ["H1", Boolean(snapshot.seo_checks.h1)],
                      ["Sitemap", Boolean(snapshot.seo_checks.sitemap)],
                      ["Robots.txt", Boolean(snapshot.seo_checks.robots)],
                      ["Schema", Boolean(snapshot.seo_checks.schema_org)],
                      ["Open Graph", Boolean(snapshot.seo_checks.og_tags)],
                    ].map(([label, passed]) => (
                      <div
                        key={String(label)}
                        className="flex items-center justify-between rounded-lg border px-3 py-2"
                      >
                        <span>{String(label)}</span>
                        <Badge
                          variant="outline"
                          className={
                            passed
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                              : "border-red-200 bg-red-50 text-red-800"
                          }
                        >
                          {passed ? "Godkänd" : "Brister"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Den tekniska crawlen saknas.
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <MapPin className="size-4" />
                  Lokal synlighet
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <LabMetric
                    label="Betyg"
                    value={
                      snapshot?.business_profile?.rating == null
                        ? "Saknas"
                        : snapshot.business_profile.rating.toFixed(1)
                    }
                  />
                  <LabMetric
                    label="Recensioner"
                    value={
                      snapshot?.business_profile?.reviews_count == null
                        ? "Saknas"
                        : String(snapshot.business_profile.reviews_count)
                    }
                  />
                  <LabMetric
                    label="Samtal"
                    value={
                      snapshot?.gbp_actions
                        ? String(snapshot.gbp_actions.calls)
                        : "Saknas"
                    }
                  />
                  <LabMetric
                    label="Webbplatsklick"
                    value={
                      snapshot?.gbp_actions
                        ? String(snapshot.gbp_actions.website_clicks)
                        : "Saknas"
                    }
                  />
                </div>
                {snapshot?.local_rank?.length ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Lokal ranking
                    </p>
                    {snapshot.local_rank.slice(0, 5).map((rank) => (
                      <div
                        key={rank.keyword}
                        className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                      >
                        <span>{rank.keyword}</span>
                        <span className="text-muted-foreground">
                          {rank.found && rank.position != null
                            ? `Plats ${rank.position}`
                            : "Inte hittad"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              {snapshot?.competitors?.length ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Konkurrentjämförelse</h3>
                  <div className="space-y-2">
                    {snapshot.competitors.slice(0, 4).map((competitor) => (
                      <div
                        key={competitor.url}
                        className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                      >
                        <span className="truncate">{competitor.url}</span>
                        <span className="shrink-0 text-muted-foreground">
                          Prestanda {competitor.performance_score ?? "—"} · SEO{" "}
                          {competitor.seo_score ?? "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Prioriterad åtgärd</h3>
                {row.viewModel?.primaryRecommendation ? (
                  <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                    <p className="font-medium">
                      {row.viewModel.primaryRecommendation.title}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {row.viewModel.primaryRecommendation.description}
                    </p>
                    <p className="mt-2 text-xs font-medium">
                      Axona-tjänst:{" "}
                      {row.viewModel.primaryRecommendation.service}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Ingen prioriterad brist i periodens verifierade data.
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <Button asChild>
                  <Link to={`/companies/${row.companyId}/show/customer`}>
                    <ExternalLink className="size-4" />
                    Öppna kundbilden
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onAnalyze(row)}
                  disabled={busyAction != null}
                >
                  <RefreshCw
                    className={
                      busyAction === `analyze-${row.companyId}`
                        ? "size-4 animate-spin"
                        : "size-4"
                    }
                  />
                  Hämta om vald månad
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onGenerateReport(row)}
                  disabled={busyAction != null}
                >
                  <FileText className="size-4" />
                  {row.report ? "Granska rapport" : "Skapa rapport"}
                </Button>
                {row.report?.pdf_storage_path ? (
                  <Button
                    variant="outline"
                    onClick={() => onDownloadPdf(row)}
                    disabled={busyAction != null}
                  >
                    <Download className="size-4" />
                    Ladda ned PDF
                  </Button>
                ) : null}
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function DetailMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <p className="mt-1 font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function CoreWebVital({
  label,
  value,
  rating,
}: {
  label: string;
  value: string;
  rating?: "GOOD" | "NEEDS_IMPROVEMENT" | "POOR" | null;
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold tabular-nums">{value}</p>
      <p
        className={
          rating === "GOOD"
            ? "mt-1 text-xs text-emerald-700"
            : rating === "POOR"
              ? "mt-1 text-xs text-red-700"
              : "mt-1 text-xs text-amber-700"
        }
      >
        {rating === "GOOD"
          ? "Bra"
          : rating === "POOR"
            ? "Dålig"
            : rating === "NEEDS_IMPROVEMENT"
              ? "Kan förbättras"
              : "Saknas"}
      </p>
    </div>
  );
}

function LabMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold tabular-nums">{value}</p>
    </div>
  );
}
