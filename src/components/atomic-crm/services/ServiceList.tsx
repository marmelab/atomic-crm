import { useCallback } from "react";
import { useListContext, type Exporter } from "ra-core";
import { downloadCSVItalian } from "@/lib/downloadCsvItalian";
import { CreateButton } from "@/components/admin/create-button";
import { ExportButton } from "@/components/admin/export-button";
import { List } from "@/components/admin/list";
import { SortButton } from "@/components/admin/sort-button";
import { useIsMobile } from "@/hooks/use-mobile";

import type { Project, Service } from "../types";
import { ServiceListContent } from "./ServiceListContent";
import { ServiceListFilter, ServiceMobileFilter } from "./ServiceListFilter";
import { TopToolbar } from "../layout/TopToolbar";
import { useConfigurationContext } from "../root/ConfigurationContext";
import {
  calculateKmReimbursement,
  calculateServiceNetValue,
} from "@/lib/semantics/crmSemanticRegistry";

export const ServiceList = () => {
  const { serviceTypeChoices, operationalConfig } = useConfigurationContext();
  const typeLabels: Record<string, string> = Object.fromEntries(
    serviceTypeChoices.map((t) => [t.value, t.label]),
  );
  const defaultKmRate = operationalConfig.defaultKmRate;

  const exporter: Exporter<Service> = useCallback(
    async (records, fetchRelatedRecords) => {
      const withProject = records.filter((s) => s.project_id);
      const projects = withProject.length
        ? await fetchRelatedRecords<Project>(withProject, "project_id", "projects")
        : {};
      const rows = records.map((s) => ({
        data_inizio: s.service_date,
        data_fine: s.service_end ?? "",
        tutto_il_giorno: s.all_day ? "Sì" : "No",
        progetto: s.project_id ? (projects[s.project_id]?.name ?? "") : "",
        tipo: typeLabels[s.service_type] ?? s.service_type,
        tassabile: s.is_taxable === false ? "No" : "Sì",
        riprese: s.fee_shooting,
        montaggio: s.fee_editing,
        altro: s.fee_other,
        sconto: s.discount,
        totale: calculateServiceNetValue(s),
        km: s.km_distance,
        rimborso_km: calculateKmReimbursement({
          kmDistance: s.km_distance,
          kmRate: s.km_rate,
          defaultKmRate,
        }),
        localita: s.location ?? "",
        rif_fattura: s.invoice_ref ?? "",
        note: s.notes ?? "",
      }));
      downloadCSVItalian(rows, "registro_lavori");
    },
    [defaultKmRate, typeLabels],
  );

  return (
    <List
      title={false}
      actions={<ServiceListActions exporter={exporter} />}
      perPage={50}
      sort={{ field: "service_date", order: "DESC" }}
      exporter={exporter}
    >
      <ServiceListLayout />
    </List>
  );
};

const ServiceListLayout = () => {
  const { data, isPending, filterValues } = useListContext();
  const hasFilters = filterValues && Object.keys(filterValues).length > 0;

  if (isPending) return null;
  if (!data?.length && !hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground mb-4">Nessun servizio registrato</p>
        <CreateButton />
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col md:flex-row md:gap-8">
      <ServiceListFilter />
      <div className="w-full flex flex-col gap-4">
        <ServiceListContent />
      </div>
    </div>
  );
};

const ServiceListActions = ({ exporter }: { exporter: Exporter<Service> }) => {
  const isMobile = useIsMobile();
  return (
    <TopToolbar className={isMobile ? "justify-center" : undefined}>
      {isMobile && <ServiceMobileFilter />}
      <SortButton fields={["service_date", "created_at"]} />
      <ExportButton exporter={exporter} />
      <CreateButton />
    </TopToolbar>
  );
};
