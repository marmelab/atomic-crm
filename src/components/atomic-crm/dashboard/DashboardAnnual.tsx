import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Settings,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { useRealtimeInvalidation } from "@/hooks/useRealtimeInvalidation";

import { Welcome } from "./Welcome";
import { DashboardAnnualAiSummaryCard } from "./DashboardAnnualAiSummaryCard";
import { DashboardAtecoChart } from "./DashboardAtecoChart";
import { DashboardBusinessHealthCard } from "./DashboardBusinessHealthCard";
import { DashboardCashFlowCard } from "./DashboardCashFlowCard";
import { DashboardCategoryChart } from "./DashboardCategoryChart";
import { DashboardDeadlineTracker } from "./DashboardDeadlineTracker";
import { DashboardDeadlinesCard } from "./DashboardDeadlinesCard";
import { DashboardFiscalKpis } from "./DashboardFiscalKpis";
import { DashboardKpiCards } from "./DashboardKpiCards";
import { DashboardLoading } from "./DashboardLoading";
import { DashboardPipelineCard } from "./DashboardPipelineCard";
import { DashboardRevenueTrendChart } from "./DashboardRevenueTrendChart";
import { DashboardTopClientsCard } from "./DashboardTopClientsCard";
import { useDashboardData } from "./useDashboardData";
import { useFiscalPaymentTracking } from "./useFiscalPaymentTracking";
import { useGenerateFiscalTasks } from "./useGenerateFiscalTasks";

const currentYear = new Date().getFullYear();

const REALTIME_TABLES = [
  "payments",
  "services",
  "projects",
  "quotes",
  "expenses",
  "clients",
  "client_tasks",
];

export const DashboardAnnual = () => {
  useRealtimeInvalidation(REALTIME_TABLES);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const { data, isPending, error, refetch } = useDashboardData(selectedYear);
  const isCurrentYear = data?.isCurrentYear ?? selectedYear === currentYear;

  const { generate: generateFiscalTasks, existingCount: fiscalTasksCount } =
    useGenerateFiscalTasks({
      deadlines: data?.fiscal?.deadlines ?? [],
      year: selectedYear,
    });

  const {
    markAsPaid,
    clearPayment,
    getPayment,
    totalPaid: totalTaxesPaid,
  } = useFiscalPaymentTracking(selectedYear);

  if (isPending || !data) {
    if (error) {
      return <DashboardAnnualError onRetry={refetch} />;
    }
    return <DashboardLoading />;
  }

  return (
    <div className="space-y-6">
      {import.meta.env.VITE_IS_DEMO === "true" ? <Welcome /> : null}

      <YearSelector
        year={selectedYear}
        onPrev={() => setSelectedYear((y) => y - 1)}
        onNext={() => setSelectedYear((y) => Math.min(y + 1, currentYear))}
        isCurrentYear={isCurrentYear}
      />

      <p className="text-sm text-muted-foreground -mt-3">
        {isCurrentYear
          ? `Lavoro svolto al ${data.meta.asOfDateLabel}`
          : `Riepilogo ${data.selectedYear}`}
      </p>

      <DashboardAnnualAiSummaryCard year={data.selectedYear} />

      <DashboardKpiCards
        kpis={data.kpis}
        meta={data.meta}
        year={data.selectedYear}
        fiscalKpis={data.fiscal?.fiscalKpis ?? null}
        taxesPaid={totalTaxesPaid}
      />

      {isCurrentYear && data.cashFlowForecast && (
        <DashboardCashFlowCard forecast={data.cashFlowForecast} />
      )}

      {isCurrentYear && (
        <DashboardDeadlineTracker alerts={data.alerts} />
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <DashboardRevenueTrendChart
          data={data.revenueTrend}
          meta={data.meta}
          qualityFlags={data.qualityFlags}
          year={data.selectedYear}
          isCurrentYear={isCurrentYear}
        />
        <DashboardCategoryChart
          data={data.categoryBreakdown}
          meta={data.meta}
          year={data.selectedYear}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <DashboardPipelineCard data={data.quotePipeline} />
        <DashboardTopClientsCard
          data={data.topClients}
          year={data.selectedYear}
        />
      </div>

      {data.fiscal ? (
        <>
          <h2 className="text-xl font-semibold mt-2">
            {isCurrentYear
              ? "Simulazione fiscale & salute aziendale"
              : `Simulazione fiscale ${selectedYear}`}
          </h2>

          <p className="text-xs text-muted-foreground -mt-3">
            Questa parte usa ipotesi fiscali e configurazione del regime
            forfettario: trattala come simulazione, non come dichiarazione
            definitiva.
          </p>

          {isCurrentYear && data.fiscal.warnings.length > 0 && (
            <div className="space-y-2">
              {data.fiscal.warnings.map((w) => (
                <div
                  key={w.type}
                  className={`flex items-center gap-2 rounded-md p-3 text-sm ${
                    w.type === "ceiling_critical"
                      ? "bg-destructive/10 text-destructive"
                      : w.type === "ceiling_exceeded"
                        ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {w.message}
                </div>
              ))}
            </div>
          )}

          <DashboardFiscalKpis
            fiscalKpis={data.fiscal.fiscalKpis}
            warnings={data.fiscal.warnings}
            isCurrentYear={isCurrentYear}
          />

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <DashboardAtecoChart
              data={data.fiscal.atecoBreakdown}
              year={data.selectedYear}
            />
            {isCurrentYear && (
              <DashboardDeadlinesCard
                deadlines={data.fiscal.deadlines}
                isFirstYear={data.fiscal.deadlines.length === 0}
                onGenerateTasks={generateFiscalTasks}
                existingTasksCount={fiscalTasksCount}
                getPayment={getPayment}
                onMarkPaid={(deadline) =>
                  markAsPaid(
                    deadline,
                    deadline.totalAmount,
                    new Date().toISOString().slice(0, 10),
                  )
                }
                onClearPayment={clearPayment}
              />
            )}
          </div>

          {isCurrentYear && (
            <DashboardBusinessHealthCard health={data.fiscal.businessHealth} />
          )}
        </>
      ) : (
        <Card className="mt-2">
          <CardContent className="px-6 py-8 text-center">
            <Settings className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-3">
              Configura i parametri fiscali per visualizzare il simulatore
              fiscale e i KPI di salute aziendale.
            </p>
            <Link to="/settings">
              <Badge variant="outline" className="cursor-pointer">
                Impostazioni → Fiscale
              </Badge>
            </Link>
          </CardContent>
        </Card>
      )}

    </div>
  );
};

const YearSelector = ({
  year,
  onPrev,
  onNext,
  isCurrentYear,
}: {
  year: number;
  onPrev: () => void;
  onNext: () => void;
  isCurrentYear: boolean;
}) => (
  <div className="flex items-center gap-2">
    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPrev}>
      <ChevronLeft className="h-4 w-4" />
    </Button>
    <span className="text-lg font-semibold tabular-nums min-w-[4ch] text-center">
      {year}
    </span>
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={onNext}
      disabled={isCurrentYear}
    >
      <ChevronRight className="h-4 w-4" />
    </Button>
  </div>
);

const DashboardAnnualError = ({ onRetry }: { onRetry: () => void }) => (
  <Card className="mt-1">
    <CardContent className="px-6 py-10 text-center">
      <p className="text-sm text-muted-foreground mb-4">
        Impossibile caricare i dati della dashboard.
      </p>
      <Button variant="outline" onClick={onRetry} className="gap-2">
        <RefreshCw className="h-4 w-4" />
        Riprova
      </Button>
    </CardContent>
  </Card>
);
