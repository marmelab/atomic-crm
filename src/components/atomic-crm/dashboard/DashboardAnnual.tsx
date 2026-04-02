import {
  ChevronLeft,
  ChevronRight,
  FilePlus,
  PenLine,
  Plus,
  RefreshCw,
  Settings,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useDataProvider } from "ra-core";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { todayISODate } from "@/lib/dateTimezone";
import { useRealtimeInvalidation } from "@/hooks/useRealtimeInvalidation";

import type { CrmDataProvider } from "../providers/types";
import { DashboardAnnualAiSummaryCard } from "./DashboardAnnualAiSummaryCard";
import { DashboardAtecoChart } from "./DashboardAtecoChart";
import { DashboardBusinessHealthCard } from "./DashboardBusinessHealthCard";
import { DashboardCashFlowCard } from "./DashboardCashFlowCard";
import { DashboardCategoryChart } from "./DashboardCategoryChart";
import { DashboardDeadlineTracker } from "./DashboardDeadlineTracker";
import { DashboardDeadlinesCard } from "./DashboardDeadlinesCard";
import { DichiarazioneEntryDialog } from "./DichiarazioneEntryDialog";
import { DashboardFiscalKpis } from "./DashboardFiscalKpis";
import { DashboardFiscalWarnings } from "./DashboardFiscalWarnings";
import { DashboardKpiCards } from "./DashboardKpiCards";
import { DashboardLoading } from "./DashboardLoading";
import { DashboardPipelineCard } from "./DashboardPipelineCard";
import { DashboardRevenueTrendChart } from "./DashboardRevenueTrendChart";
import { DashboardTopClientsCard } from "./DashboardTopClientsCard";
import { F24RegistrationDialog } from "./F24RegistrationDialog";
import { ObligationEntryDialog } from "./ObligationEntryDialog";
import type { FiscalDeadlineView } from "./fiscalRealityTypes";
import { useDashboardData } from "./useDashboardData";
import { useFiscalPaymentTracking } from "./useFiscalPaymentTracking";
import { useFiscalReality } from "./useFiscalReality";
import { useGenerateFiscalTasks } from "./useGenerateFiscalTasks";

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
  const currentYear = Number(todayISODate().slice(0, 4));
  useRealtimeInvalidation(REALTIME_TABLES);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const { data, isPending, error, refetch } = useDashboardData(selectedYear);
  const isCurrentYear = data?.isCurrentYear ?? selectedYear === currentYear;
  const dataProvider = useDataProvider<CrmDataProvider>();

  const { generate: generateFiscalTasks, existingCount: fiscalTasksCount } =
    useGenerateFiscalTasks({
      deadlines: data?.fiscal?.deadlines ?? [],
      year: selectedYear,
    });

  const { markAsPaid, clearPayment, getPayment } =
    useFiscalPaymentTracking(selectedYear);

  const { deadlineViews, totalOpenObligations, hasRealFiscalData } =
    useFiscalReality({
      estimatedDeadlines: data?.fiscal?.schedule.deadlines ?? [],
      paymentYear: selectedYear,
      todayIso: todayISODate(),
    });

  // Dialog states
  const [f24Target, setF24Target] = useState<FiscalDeadlineView | null>(null);
  const [showDichiarazione, setShowDichiarazione] = useState(false);
  const [showObligation, setShowObligation] = useState(false);

  // Check if declaration exists for the fiscal year (selectedYear - 1)
  const declarationTaxYear = selectedYear - 1;
  const { data: existingDeclaration } = useQuery({
    queryKey: ["fiscal-declaration", declarationTaxYear],
    queryFn: () => dataProvider.getFiscalDeclaration(declarationTaxYear),
    enabled: data?.fiscal != null,
  });

  if (isPending || !data) {
    if (error) {
      return <DashboardAnnualError onRetry={refetch} />;
    }
    return <DashboardLoading />;
  }

  return (
    <div className="space-y-6">
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
        totalOpenObligations={
          deadlineViews != null ? totalOpenObligations : undefined
        }
      />

      {isCurrentYear && data.cashFlowForecast && (
        <DashboardCashFlowCard forecast={data.cashFlowForecast} />
      )}

      {isCurrentYear && <DashboardDeadlineTracker alerts={data.alerts} />}

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
          <div className="flex items-center justify-between mt-2">
            <h2 className="text-xl font-semibold">
              {isCurrentYear
                ? "Simulazione fiscale & salute aziendale"
                : `Simulazione fiscale ${selectedYear}`}
            </h2>
            {isCurrentYear && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => setShowDichiarazione(true)}
                >
                  {existingDeclaration ? (
                    <>
                      <PenLine className="h-3.5 w-3.5" />
                      Modifica dichiarazione {declarationTaxYear}
                    </>
                  ) : (
                    <>
                      <FilePlus className="h-3.5 w-3.5" />
                      Inserisci dichiarazione {declarationTaxYear}
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => setShowObligation(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Aggiungi obbligazione
                </Button>
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground -mt-3">
            Questa parte usa ipotesi fiscali e configurazione del regime
            forfettario: trattala come simulazione, non come dichiarazione
            definitiva.
          </p>

          <DashboardFiscalWarnings warnings={data.fiscal.warnings} />

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
                schedule={data.fiscal.schedule}
                onGenerateTasks={generateFiscalTasks}
                existingTasksCount={fiscalTasksCount}
                getPayment={getPayment}
                onMarkPaid={(deadline) =>
                  markAsPaid(deadline, deadline.totalAmount, todayISODate())
                }
                onClearPayment={clearPayment}
                deadlineViews={deadlineViews ?? undefined}
                onRegisterF24={setF24Target}
                hasRealFiscalData={hasRealFiscalData}
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

      {/* Fiscal entry dialogs */}
      <DichiarazioneEntryDialog
        open={showDichiarazione}
        onOpenChange={setShowDichiarazione}
        taxYear={declarationTaxYear}
        estimatedSubstituteTax={
          data?.fiscal?.fiscalKpis.stimaImpostaAnnuale
        }
        estimatedInps={data?.fiscal?.fiscalKpis.stimaInpsAnnuale}
      />

      <F24RegistrationDialog
        open={f24Target != null}
        onOpenChange={(open) => {
          if (!open) setF24Target(null);
        }}
        deadlineView={f24Target}
      />

      <ObligationEntryDialog
        open={showObligation}
        onOpenChange={setShowObligation}
        defaultCompetenceYear={selectedYear}
        defaultPaymentYear={selectedYear}
      />
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
