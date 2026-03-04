import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { useStore } from "ra-core";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { DashboardLoading } from "./DashboardLoading";
import { DashboardHistoricalCategoryMixChart } from "./DashboardHistoricalCategoryMixChart";
import { DashboardHistoricalAiSummaryCard } from "./DashboardHistoricalAiSummaryCard";
import { DashboardHistoricalCashInflowCard } from "./DashboardHistoricalCashInflowCard";
import { DashboardHistoricalCashInflowAiCard } from "./DashboardHistoricalCashInflowAiCard";
import { DashboardHistoricalKpis } from "./DashboardHistoricalKpis";
import { DashboardHistoricalRevenueChart } from "./DashboardHistoricalRevenueChart";
import { DashboardHistoricalTopClientsCard } from "./DashboardHistoricalTopClientsCard";
import { useHistoricalDashboardData } from "./useHistoricalDashboardData";

export const DashboardHistorical = () => {
  const [readingGuideDismissed, setReadingGuideDismissed] = useStore<boolean>(
    "dashboard.readingGuide.dismissed",
    false,
  );
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
      {readingGuideDismissed ? (
        <div>
          <Button
            variant="link"
            className="h-auto px-0 text-xs"
            onClick={() => setReadingGuideDismissed(false)}
          >
            Come leggere Storico
          </Button>
        </div>
      ) : (
        <HistoricalReadingGuide
          onDismiss={() => setReadingGuideDismissed(true)}
        />
      )}

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
        <HistoricalContextCard model={data} />
      </div>

      <DashboardHistoricalCashInflowCard />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <DashboardHistoricalAiSummaryCard />
        <DashboardHistoricalCashInflowAiCard />
      </div>
    </div>
  );
};

const HistoricalReadingGuide = ({ onDismiss }: { onDismiss: () => void }) => (
  <div className="rounded-xl border bg-card px-4 py-3">
    <div className="mb-2 flex items-start justify-between gap-3">
      <p className="text-sm font-medium">Tradotto in semplice</p>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground"
        onClick={onDismiss}
        aria-label="Chiudi guida lettura storico"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
    <div className="mt-2 space-y-2 text-xs text-muted-foreground">
      <p>
        Qui non stai guardando i soldi già entrati in banca: stai guardando il
        valore del lavoro attribuito a ogni anno.
      </p>
      <p>
        L'anno in corso è parziale: contiamo solo quello che risulta fino a
        oggi.
      </p>
      <p>
        La crescita si confronta solo tra anni completi, per evitare confronti
        falsati.
      </p>
    </div>
  </div>
);

const HistoricalContextCard = ({
  model,
}: {
  model: NonNullable<ReturnType<typeof useHistoricalDashboardData>["data"]>;
}) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-base">
        Spiegazione semplice dei numeri
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">Che cosa stiamo contando</p>
        <p className="text-xs text-muted-foreground">
          Qui stiamo misurando il valore del lavoro dal{" "}
          {model.meta.firstYearWithData ?? model.meta.currentYear} al{" "}
          {model.meta.currentYear}, non i soldi già incassati. Il{" "}
          {model.meta.currentYear} è ancora in corso, quindi si ferma al{" "}
          {model.meta.asOfDateLabel}.
        </p>
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium">Confronto che ha senso fare</p>
        <p className="text-xs text-muted-foreground">
          La crescita va letta solo tra anni completi:{" "}
          {model.kpis.yoyClosedYears.comparisonLabel}.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">Conta il lavoro, non gli incassi</Badge>
        <Badge variant="outline">Anno in corso parziale</Badge>
        <Badge variant="outline">Foto al {model.meta.asOfDateLabel}</Badge>
      </div>

      {model.qualityFlags.includes("future_services_excluded") ? (
        <div className="rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300 px-3 py-2 text-xs">
          Ci sono lavori futuri già inseriti, ma qui non li contiamo ancora.
        </div>
      ) : null}

      {model.qualityFlags.includes("zero_baseline") ? (
        <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          Non possiamo misurare la crescita rispetto all'anno prima perché
          l'anno di partenza vale 0.
        </div>
      ) : null}

      {model.qualityFlags.includes("insufficient_closed_years") ? (
        <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          Per misurare la crescita tra un anno e l'altro servono almeno due anni
          completi.
        </div>
      ) : null}
    </CardContent>
  </Card>
);

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
