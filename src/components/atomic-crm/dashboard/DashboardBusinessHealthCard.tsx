import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

import { formatCurrency } from "./dashboardModel";
import type { BusinessHealthKpis } from "./fiscalModel";

export const DashboardBusinessHealthCard = ({
  health,
}: {
  health: BusinessHealthKpis;
}) => {
  const conversionColor = getHealthColor(health.quoteConversionRate, 50, 30);
  const dsoColor =
    health.dso != null ? getDsoColor(health.dso) : "text-muted-foreground";
  const concentrationColor = getConcentrationColor(health.clientConcentration);

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4 pb-0">
        <CardTitle className="text-base font-semibold">
          Salute aziendale
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 space-y-3">
        {/* ── 4-column summary ── */}
        <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] gap-0">
          <HealthColumn
            value={`${Math.round(health.quoteConversionRate)}%`}
            label="Conversione"
            sublabel={`${health.quotesAccepted}/${health.quotesTotal}`}
            color={conversionColor}
          />
          <Separator orientation="vertical" />
          <HealthColumn
            value={health.dso != null ? `${health.dso}g` : "N/D"}
            label="Tempi incasso"
            color={dsoColor}
          />
          <Separator orientation="vertical" />
          <HealthColumn
            value={`${Math.round(health.clientConcentration)}%`}
            label="Top 3 clienti"
            color={concentrationColor}
          />
          <Separator orientation="vertical" />
          <HealthColumn
            value={formatCurrency(health.weightedPipelineValue)}
            label="Pipeline"
            color="text-foreground"
          />
        </div>

        {/* ── Concentration bar ── */}
        <div className="space-y-1">
          <Progress
            value={Math.min(100, health.clientConcentration)}
            className="h-1.5"
          />
          <p className="text-[11px] text-muted-foreground text-center">
            Concentrazione clienti — sotto 50% è sano
          </p>
        </div>

        {/* ── Margins per category ── */}
        {health.marginPerCategory.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Margine per categoria
            </p>
            {health.marginPerCategory.map((cat) => (
              <div key={cat.category} className="flex items-center gap-2">
                <span className="text-xs w-24 truncate">{cat.label}</span>
                <Progress
                  value={Math.max(0, Math.min(100, cat.margin))}
                  className="h-1.5 flex-1"
                />
                <span className="text-xs font-medium w-10 text-right tabular-nums">
                  {Math.round(cat.margin)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const HealthColumn = ({
  value,
  label,
  sublabel,
  color,
}: {
  value: string;
  label: string;
  sublabel?: string;
  color: string;
}) => (
  <div className="text-center px-2 space-y-0.5">
    <div className={`text-xl font-bold tabular-nums ${color}`}>{value}</div>
    <div className="text-[11px] text-muted-foreground">{label}</div>
    {sublabel && (
      <div className="text-[10px] text-muted-foreground/60">{sublabel}</div>
    )}
  </div>
);

const getHealthColor = (value: number, good: number, ok: number) => {
  if (value >= good) return "text-emerald-700 dark:text-emerald-300";
  if (value >= ok) return "text-foreground";
  return "text-red-700 dark:text-red-300";
};

const getDsoColor = (days: number) => {
  if (days <= 30) return "text-emerald-700 dark:text-emerald-300";
  if (days <= 60) return "text-foreground";
  return "text-red-700 dark:text-red-300";
};

const getConcentrationColor = (pct: number) => {
  if (pct < 50) return "text-emerald-700 dark:text-emerald-300";
  if (pct < 80) return "text-amber-700 dark:text-amber-300";
  return "text-red-700 dark:text-red-300";
};
