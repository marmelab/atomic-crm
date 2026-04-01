import { BarChart3, CalendarRange } from "lucide-react";
import { useStore } from "ra-core";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { DashboardAnnual } from "./DashboardAnnual";
import { DashboardHistorical } from "./DashboardHistorical";

type DashboardMode = "annual" | "historical";

export const Dashboard = () => {
  const [mode, setMode] = useStore<DashboardMode>("dashboard.mode", "annual");

  return (
    <div className="space-y-6 mt-1 mb-28 md:mb-2">
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
          Annuale: numeri operativi dell'anno scelto. Storico: andamento degli
          ultimi anni, con l'anno in corso letto solo fino a oggi.
        </p>
      </div>

      {mode === "annual" ? <DashboardAnnual /> : <DashboardHistorical />}
    </div>
  );
};
