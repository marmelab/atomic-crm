import type {
  CustomerPerformanceCategory,
  CustomerReportDeliveryStatus,
  CustomerVisibilityRow,
  MetricTrend,
} from "../types";

export const CATEGORY_LABELS: Record<CustomerPerformanceCategory, string> = {
  very_good: "Presterar mycket bra",
  good: "Presterar bra",
  watch: "Behöver bevakas",
  poor: "Presterar dåligt",
  missing: "Data saknas",
};

export const CATEGORY_ORDER: CustomerPerformanceCategory[] = [
  "very_good",
  "good",
  "watch",
  "poor",
  "missing",
];

export const REPORT_STATUS_LABELS: Record<
  CustomerReportDeliveryStatus,
  string
> = {
  sent: "Skickad",
  draft: "Utkast",
  missing: "Saknas",
  failed: "Misslyckad",
};

export function categoryBadgeClass(category: CustomerPerformanceCategory) {
  return category === "very_good"
    ? "border-emerald-200 bg-emerald-100 text-emerald-900"
    : category === "good"
      ? "border-green-200 bg-green-50 text-green-800"
      : category === "watch"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : category === "poor"
          ? "border-red-200 bg-red-50 text-red-900"
          : "border-slate-200 bg-slate-100 text-slate-700";
}

export function reportBadgeClass(status: CustomerReportDeliveryStatus) {
  return status === "sent"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : status === "draft"
      ? "border-sky-200 bg-sky-50 text-sky-800"
      : status === "failed"
        ? "border-red-200 bg-red-50 text-red-800"
        : "border-slate-200 bg-slate-50 text-slate-700";
}

export function dataBasisLabel(
  basis: CustomerVisibilityRow["dataBasis"],
): string {
  if (basis === "official_month") return "Officiell månad";
  if (basis === "combined") return "Månad + senaste analys";
  if (basis === "latest_analysis") return "Senaste analys";
  return "Ingen analys";
}

export function formatMetric(
  metric: MetricTrend | unknown,
  format: "number" | "percent" | "decimal",
  lowerIsBetter = false,
): string {
  const trend = metric as MetricTrend | undefined;
  if (trend?.current == null) return "Saknas";
  const value =
    format === "percent"
      ? `${(trend.current * 100).toFixed(1)} %`
      : format === "decimal"
        ? trend.current.toFixed(1)
        : trend.current.toLocaleString("sv-SE");
  if (trend.deltaPct == null && trend.deltaAbsolute == null) return value;
  const delta =
    format === "decimal" ? trend.deltaAbsolute : trend.deltaPct;
  if (delta == null || Math.abs(delta) < 0.5) return `${value} · oförändrat`;
  const improved = lowerIsBetter ? delta < 0 : delta > 0;
  return `${value} · ${improved ? "↑" : "↓"} ${Math.abs(Math.round(delta))}${format === "decimal" ? "" : " %"}`;
}
