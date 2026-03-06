import { useEffect, useMemo, useState } from "react";
import { useCreate, useNotify, useRefresh } from "ra-core";
import { useLocation } from "react-router";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clapperboard } from "lucide-react";
import type { Project } from "../types";
import { useConfigurationContext } from "../root/ConfigurationContext";
import {
  QuickEpisodeForm,
  getDefaultFees,
  type EpisodeFormDefaults,
  type EpisodeFormData,
} from "./QuickEpisodeForm";
import { getUnifiedAiHandoffContextFromSearch } from "../payments/paymentLinking";
import { getProjectQuickEpisodeDefaultsFromSearch } from "./projectQuickEpisodeLinking";
import {
  buildQuickEpisodeExpenseCreateData,
  buildQuickEpisodeServiceCreateData,
} from "./quickEpisodePersistence";

interface QuickEpisodeDialogProps {
  record: Project;
}

const applyServiceTypeToDefaults = (
  defaults: EpisodeFormDefaults,
): EpisodeFormDefaults => {
  if (defaults.service_type === "riprese") {
    return {
      ...defaults,
      fee_editing: 0,
    };
  }

  if (defaults.service_type === "montaggio") {
    return {
      ...defaults,
      fee_shooting: 0,
    };
  }

  return defaults;
};

export const QuickEpisodeDialog = ({ record }: QuickEpisodeDialogProps) => {
  const { operationalConfig } = useConfigurationContext();
  const [open, setOpen] = useState(false);
  const [lastAutoOpenedSearch, setLastAutoOpenedSearch] = useState<
    string | null
  >(null);
  const [create] = useCreate();
  const notify = useNotify();
  const refresh = useRefresh();
  const [saving, setSaving] = useState(false);
  const location = useLocation();
  const launcherHandoff = getUnifiedAiHandoffContextFromSearch(location.search);
  const launcherDefaults = getProjectQuickEpisodeDefaultsFromSearch(
    location.search,
  );

  const defaults = useMemo(() => {
    const baseDefaults = getDefaultFees(
      record.tv_show,
      operationalConfig.defaultKmRate,
    );

    return applyServiceTypeToDefaults({
      ...baseDefaults,
      service_type: launcherDefaults?.serviceType ?? baseDefaults.service_type,
      service_date: launcherDefaults?.serviceDate ?? "",
      km_distance: launcherDefaults?.kmDistance ?? 0,
      km_rate: launcherDefaults?.kmRate ?? baseDefaults.km_rate,
      location: launcherDefaults?.location ?? "",
      notes: launcherDefaults?.notes ?? "",
    });
  }, [
    launcherDefaults?.kmDistance,
    launcherDefaults?.kmRate,
    launcherDefaults?.location,
    launcherDefaults?.notes,
    launcherDefaults?.serviceDate,
    launcherDefaults?.serviceType,
    operationalConfig.defaultKmRate,
    record.tv_show,
  ]);

  useEffect(() => {
    if (
      !open &&
      launcherHandoff?.action === "project_quick_episode" &&
      launcherHandoff.openDialog === "quick_episode" &&
      lastAutoOpenedSearch !== location.search
    ) {
      setOpen(true);
      setLastAutoOpenedSearch(location.search);
    }
  }, [lastAutoOpenedSearch, launcherHandoff, location.search, open]);

  const handleSubmit = async (data: EpisodeFormData) => {
    setSaving(true);
    try {
      await create(
        "services",
        {
          data: buildQuickEpisodeServiceCreateData({
            record,
            data,
          }),
        },
        { returnPromise: true },
      );

      const expensePayloads = buildQuickEpisodeExpenseCreateData({
        record,
        data,
      });

      for (const expensePayload of expensePayloads) {
        await create(
          "expenses",
          {
            data: expensePayload,
          },
          { returnPromise: true },
        );
      }

      notify("Puntata registrata", { type: "success" });
      refresh();
      setOpen(false);
    } catch {
      notify("Errore durante la registrazione", { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="default">
          <Clapperboard className="size-4 mr-1" />
          Puntata
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registra Puntata — {record.name}</DialogTitle>
        </DialogHeader>
        {launcherHandoff?.action === "project_quick_episode" ? (
          <div className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            Apertura guidata dalla chat AI unificata. Data, note e, se
            disponibili, chilometri e tariffa arrivano gia precompilati, ma il
            dialog resta manuale: controlla tutto prima di confermare.
          </div>
        ) : null}
        <QuickEpisodeForm
          defaults={defaults}
          defaultTravelOrigin={operationalConfig.defaultTravelOrigin}
          saving={saving}
          onSubmit={handleSubmit}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
};
