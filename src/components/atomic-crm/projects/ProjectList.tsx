import { useListContext, type Exporter } from "ra-core";
import { downloadCSVItalian } from "@/lib/downloadCsvItalian";
import { CreateButton } from "@/components/admin/create-button";
import { ExportButton } from "@/components/admin/export-button";
import { List } from "@/components/admin/list";
import { SortButton } from "@/components/admin/sort-button";
import { useIsMobile } from "@/hooks/use-mobile";

import type { Client, Project } from "../types";
import { ProjectListContent } from "./ProjectListContent";
import { ProjectListFilter, ProjectMobileFilter } from "./ProjectListFilter";
import { TopToolbar } from "../layout/TopToolbar";

export const ProjectList = () => (
  <List
    title={false}
    actions={<ProjectListActions />}
    perPage={25}
    sort={{ field: "start_date", order: "DESC" }}
    exporter={exporter}
  >
    <ProjectListLayout />
  </List>
);

const ProjectListLayout = () => {
  const { data, isPending, filterValues } = useListContext();
  const hasFilters = filterValues && Object.keys(filterValues).length > 0;

  if (isPending) return null;
  if (!data?.length && !hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground mb-4">Nessun progetto</p>
        <CreateButton />
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col md:flex-row md:gap-8">
      <ProjectListFilter />
      <div className="w-full flex flex-col gap-4">
        <ProjectListContent />
      </div>
    </div>
  );
};

const ProjectListActions = () => {
  const isMobile = useIsMobile();
  return (
    <TopToolbar className={isMobile ? "justify-center" : undefined}>
      {isMobile && <ProjectMobileFilter />}
      <SortButton fields={["name", "start_date", "created_at"]} />
      <ExportButton exporter={exporter} />
      <CreateButton />
    </TopToolbar>
  );
};

const exporter: Exporter<Project> = async (records, fetchRelatedRecords) => {
  const clients = await fetchRelatedRecords<Client>(
    records,
    "client_id",
    "clients",
  );
  const projects = records.map((project) => ({
    nome: project.name,
    cliente: clients[project.client_id]?.name ?? "",
    categoria: project.category,
    programma_tv: project.tv_show ?? "",
    stato: project.status,
    data_inizio: project.start_date ?? "",
    data_fine: project.end_date ?? "",
    tutto_il_giorno: project.all_day ? "Sì" : "No",
    budget: project.budget ?? "",
    note: project.notes ?? "",
  }));
  downloadCSVItalian(projects, "progetti");
};
