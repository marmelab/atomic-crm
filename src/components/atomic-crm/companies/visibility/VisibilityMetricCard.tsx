import type { MetricExplanationContent } from "./MetricExplanation";
import { MetricExplanation } from "./MetricExplanation";

export function VisibilityMetricCard({
  label,
  value,
  trend,
  explanation,
}: {
  label: string;
  value: string;
  trend: string;
  explanation: MetricExplanationContent;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        <MetricExplanation label={label} content={explanation} />
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{trend}</p>
    </div>
  );
}
