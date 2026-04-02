import {
  BarChart3,
  CalendarClock,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  FilePlus,
  PenLine,
  PiggyBank,
  Plus,
  Shield,
} from "lucide-react";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { useDataProvider, useTimeout } from "ra-core";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { useRealtimeInvalidation } from "@/hooks/useRealtimeInvalidation";
import { formatBusinessDate, todayISODate } from "@/lib/dateTimezone";

import { MobileContent } from "../layout/MobileContent";
import type { CrmDataProvider } from "../providers/types";
import { DashboardHistorical } from "./DashboardHistorical";
import { DashboardAnnualAiSummaryCard } from "./DashboardAnnualAiSummaryCard";
import { DashboardFiscalWarnings } from "./DashboardFiscalWarnings";
import { DichiarazioneEntryDialog } from "./DichiarazioneEntryDialog";
import { F24RegistrationDialog } from "./F24RegistrationDialog";
import { ObligationEntryDialog } from "./ObligationEntryDialog";
import { formatCurrency, formatCurrencyPrecise } from "./dashboardModel";
import type { FiscalModel } from "./fiscalModel";
import type { FiscalDeadlineView } from "./fiscalRealityTypes";
import { DashboardKpiCards } from "./DashboardKpiCards";
import { MobileDashboardLoading } from "./DashboardLoading";
import { useDashboardData } from "./useDashboardData";
import { useFiscalReality } from "./useFiscalReality";

const Wrapper = ({ children }: { children: React.ReactNode }) => {
  return <MobileContent>{children}</MobileContent>;
};

export const MobileDashboard = () => {
  const [mode, setMode] = useState<"annual" | "historical">("annual");

  return (
    <Wrapper>
      <div className="space-y-4 mt-1">
        <div className="space-y-2">
          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={(value) => {
              if (value === "annual" || value === "historical") {
                setMode(value);
              }
            }}
            variant="outline"
            className="w-full justify-start"
          >
            <ToggleGroupItem value="annual" aria-label="Vista annuale">
              <CalendarRange className="h-4 w-4" />
              Annuale
            </ToggleGroupItem>
            <ToggleGroupItem value="historical" aria-label="Vista storica">
              <BarChart3 className="h-4 w-4" />
              Storico
            </ToggleGroupItem>
          </ToggleGroup>
          <p className="text-xs text-muted-foreground">
            Storico: andamento degli ultimi anni, con l'anno in corso letto solo
            fino a oggi.
          </p>
        </div>

        {mode === "historical" ? (
          <DashboardHistorical compact />
        ) : (
          <MobileAnnualDashboard />
        )}
      </div>
    </Wrapper>
  );
};

const REALTIME_TABLES = [
  "payments",
  "services",
  "projects",
  "quotes",
  "expenses",
  "clients",
  "client_tasks",
];

const MobileAnnualDashboard = () => {
  const currentYear = Number(todayISODate().slice(0, 4));
  useRealtimeInvalidation(REALTIME_TABLES);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const { data, isPending, error, refetch } = useDashboardData(selectedYear);
  const isCurrentYear = data?.isCurrentYear ?? selectedYear === currentYear;
  const showLoading = useTimeout(800);
  const dataProvider = useDataProvider<CrmDataProvider>();

  const { deadlineViews, totalOpenObligations } = useFiscalReality({
    estimatedDeadlines: data?.fiscal?.schedule.deadlines ?? [],
    paymentYear: selectedYear,
    todayIso: todayISODate(),
  });

  // Fiscal dialog states
  const [showDichiarazione, setShowDichiarazione] = useState(false);
  const [showObligation, setShowObligation] = useState(false);
  const [f24Target, setF24Target] = useState<FiscalDeadlineView | null>(null);

  // Check if declaration exists for fiscal year (selectedYear - 1)
  const declarationTaxYear = selectedYear - 1;
  const { data: existingDeclaration } = useQuery({
    queryKey: ["fiscal-declaration", declarationTaxYear],
    queryFn: () => dataProvider.getFiscalDeclaration(declarationTaxYear),
    enabled: data?.fiscal != null,
  });

  if ((isPending || !data) && !error) {
    return showLoading ? <MobileDashboardLoading /> : null;
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Impossibile caricare la dashboard.
          </p>
          <Button variant="outline" onClick={refetch} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Riprova
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setSelectedYear((y) => y - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-lg font-semibold tabular-nums min-w-[4ch] text-center">
          {selectedYear}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setSelectedYear((y) => Math.min(y + 1, currentYear))}
          disabled={isCurrentYear}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <DashboardAnnualAiSummaryCard year={data.selectedYear} compact />
      <DashboardKpiCards
        kpis={data.kpis}
        meta={data.meta}
        year={data.selectedYear}
        fiscalKpis={data.fiscal?.fiscalKpis ?? null}
        totalOpenObligations={
          deadlineViews != null ? totalOpenObligations : undefined
        }
        compact
      />
      {data.fiscal && (
        <>
          {isCurrentYear && (
            <div className="flex flex-wrap gap-2">
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
          <DashboardFiscalWarnings warnings={data.fiscal.warnings} />
          <MobileFiscalKpis
            fiscal={data.fiscal}
            deadlineViews={deadlineViews ?? undefined}
          />
        </>
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

const getCeilingVariant = (pct: number) => {
  if (pct >= 90) return "destructive" as const;
  if (pct >= 70) return "warning" as const;
  return "success" as const;
};

const MobileFiscalKpis = ({
  fiscal,
  deadlineViews,
}: {
  fiscal: FiscalModel;
  deadlineViews?: FiscalDeadlineView[];
}) => {
  const { fiscalKpis, schedule } = fiscal;

  // Prefer reality-aware view for next deadline
  const nextDeadlineView = deadlineViews?.find(
    (d) => d.priority === "high" && !d.isPast && d.totalRemaining > 0,
  );
  const nextHighPriorityDeadline = nextDeadlineView
    ? null
    : schedule.deadlines.find(
        (deadline) => deadline.priority === "high" && !deadline.isPast,
      );

  return (
    <div className="grid grid-cols-1 gap-3">
      {/* Monthly set-aside */}
      <Card className="gap-2 py-3">
        <CardHeader className="px-4 pb-0 flex flex-row items-center justify-between space-y-0 gap-2">
          <CardTitle className="text-sm font-medium">
            Accantonamento mensile consigliato
          </CardTitle>
          <PiggyBank className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="px-4">
          <div className="text-xl font-semibold">
            {formatCurrencyPrecise(fiscalKpis.accantonamentoMensile)}
          </div>
        </CardContent>
      </Card>

      {/* Next deadline */}
      <Card className="gap-2 py-3">
        <CardHeader className="px-4 pb-0 flex flex-row items-center justify-between space-y-0 gap-2">
          <CardTitle className="text-sm font-medium">
            Prossimo versamento stimato
          </CardTitle>
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="px-4 space-y-1">
          {schedule.isFirstYear ? (
            <p className="text-sm text-muted-foreground">
              Primo anno: nessun saldo o acconto stimato in questo anno di
              pagamento.
            </p>
          ) : nextDeadlineView ? (
            <>
              <div className="text-xl font-semibold">
                {formatCurrency(nextDeadlineView.totalRemaining)}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatBusinessDate(nextDeadlineView.date, {
                  day: "2-digit",
                  month: "long",
                })}{" "}
                — {nextDeadlineView.label} ({nextDeadlineView.daysUntil}g)
              </p>
              {nextDeadlineView.totalPaid > 0 && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                  {formatCurrencyPrecise(nextDeadlineView.totalPaid)} già versati
                </p>
              )}
            </>
          ) : nextHighPriorityDeadline ? (
            <>
              <div className="text-xl font-semibold">
                {formatCurrency(nextHighPriorityDeadline.totalAmount)}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatBusinessDate(nextHighPriorityDeadline.date, {
                  day: "2-digit",
                  month: "long",
                })}{" "}
                — {nextHighPriorityDeadline.label} (
                {nextHighPriorityDeadline.daysUntil}g)
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nessun versamento stimato ancora aperto nell&apos;anno
              selezionato.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Ceiling */}
      <Card className="gap-2 py-3">
        <CardHeader className="px-4 pb-0 flex flex-row items-center justify-between space-y-0 gap-2">
          <CardTitle className="text-sm font-medium">
            Tetto forfettario stimato
          </CardTitle>
          <Shield className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="px-4 space-y-2">
          <Progress
            value={Math.min(100, fiscalKpis.percentualeUtilizzoTetto)}
            variant={getCeilingVariant(fiscalKpis.percentualeUtilizzoTetto)}
            className="h-2"
          />
          <p className="text-xs text-muted-foreground">
            {Math.round(fiscalKpis.percentualeUtilizzoTetto)}% utilizzato —{" "}
            {formatCurrency(Math.abs(fiscalKpis.distanzaDalTetto))}
            {fiscalKpis.distanzaDalTetto < 0 ? " oltre" : " rimanenti"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
