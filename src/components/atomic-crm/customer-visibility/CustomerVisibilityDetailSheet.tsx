import {
  Activity,
  Download,
  ExternalLink,
  FileText,
  Gauge,
  Globe2,
  MapPin,
  RefreshCw,
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
              </div>
              <SheetTitle>{row.companyName}</SheetTitle>
              <SheetDescription>
                Förklaringen bygger på samma perioddata som kundrapporten.
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
