import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { useRealtimeInvalidation } from "@/hooks/useRealtimeInvalidation";

import { DashboardLoading } from "./DashboardLoading";
import { DashboardHistoricalAiCard } from "./DashboardHistoricalAiCard";
import { DashboardHistoricalCategoryMixChart } from "./DashboardHistoricalCategoryMixChart";
import { DashboardHistoricalCashInflowCard } from "./DashboardHistoricalCashInflowCard";
import { DashboardHistoricalKpis } from "./DashboardHistoricalKpis";
import { DashboardHistoricalRevenueChart } from "./DashboardHistoricalRevenueChart";
import { DashboardHistoricalTopClientsCard } from "./DashboardHistoricalTopClientsCard";
import { useHistoricalDashboardData } from "./useHistoricalDashboardData";

const REALTIME_TABLES = [
  "payments",
  "services",
  "projects",
  "clients",
  "analytics_yearly_competence_revenue",
  "analytics_yearly_competence_revenue_by_category",
  "analytics_client_lifetime_competence_revenue",
];

const EXTRA_QUERY_KEYS = [["historical-cash-inflow-context"]];

export const DashboardHistorical = ({ compact }: { compact?: boolean }) => {
  useRealtimeInvalidation(REALTIME_TABLES, EXTRA_QUERY_KEYS);
  const { data, isPending, error, refetch, sectionState } =
    useHistoricalDashboardData();

  if (isPending || !data) {
    if (error) {
      return <DashboardHistoricalError onRetry={refetch} />;
    }
    return <DashboardLoading />;
  }

  if (data.isEmpty) {
    return (
      <Card>
        <CardContent className="px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Storico non disponibile: nessun servizio registrato fino al{" "}
            {data.meta.asOfDateLabel}.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Valore del lavoro dal{" "}
        {data.meta.firstYearWithData ?? data.meta.currentYear} al{" "}
        {data.meta.currentYear} · Foto al {data.meta.asOfDateLabel}
      </p>

      <DashboardHistoricalAiCard compact={compact} />

      <DashboardHistoricalKpis model={data} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <DashboardHistoricalRevenueChart model={data} />
        <DashboardHistoricalCategoryMixChart
          model={data}
          isPending={sectionState.categoryMix.isPending}
          hasError={!!sectionState.categoryMix.error}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <DashboardHistoricalTopClientsCard
          model={data}
          isPending={sectionState.topClients.isPending}
          hasError={!!sectionState.topClients.error}
        />
        <DashboardHistoricalCashInflowCard />
      </div>
    </div>
  );
};

const DashboardHistoricalError = ({ onRetry }: { onRetry: () => void }) => (
  <Card>
    <CardContent className="px-6 py-10 text-center">
      <AlertTriangle className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
      <p className="text-sm text-muted-foreground mb-4">
        Impossibile caricare lo storico aziendale.
      </p>
      <Button variant="outline" onClick={onRetry} className="gap-2">
        <RefreshCw className="h-4 w-4" />
        Riprova
      </Button>
    </CardContent>
  </Card>
);
