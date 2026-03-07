import { useCallback, useState } from "react";
import { useListContext, type Exporter } from "ra-core";
import { downloadCSVItalian } from "@/lib/downloadCsvItalian";
import { CreateButton } from "@/components/admin/create-button";
import { ExportButton } from "@/components/admin/export-button";
import { List } from "@/components/admin/list";
import { SortButton } from "@/components/admin/sort-button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import { LayoutGrid, List as ListIcon } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import type { Client, Project } from "../types";
import { ProjectListContent } from "./ProjectListContent";
import { ProjectListFilter, ProjectMobileFilter } from "./ProjectListFilter";
import { TopToolbar } from "../layout/TopToolbar";
import { MobilePageTitle } from "../layout/MobilePageTitle";
import { ProjectKanbanView } from "./ProjectKanbanView";
import {
  PROJECT_COLUMNS,
  filterExportRow,
} from "../misc/columnDefinitions";
import { ColumnVisibilityButton } from "../misc/ColumnVisibilityButton";

export const ProjectList = () => {
  const { visibleKeys, columns, toggleColumn } = useColumnVisibility(
    "projects",
    PROJECT_COLUMNS,
  );

  const exporter: Exporter<Project> = useCallback(
    async (records, fetchRelatedRecords) => {
      const clients = await fetchRelatedRecords<Client>(
        records,
        "client_id",
        "clients",
      );
      const rows = records.map((project) =>
        filterExportRow(
          {
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
          },
          visibleKeys,
          columns,
        ),
      );
      downloadCSVItalian(rows, "progetti");
    },
    [visibleKeys, columns],
  );

  return (
    <List
      title={false}
      actions={
        <ProjectListActions
          exporter={exporter}
          columns={columns}
          visibleKeys={visibleKeys}
          toggleColumn={toggleColumn}
        />
      }
      perPage={25}
      sort={{ field: "start_date", order: "DESC" }}
      exporter={exporter}
    >
      <ProjectListLayout />
    </List>
  );
};

const ProjectListLayout = () => {
  const { data, isPending, filterValues } = useListContext();
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const hasFilters = filterValues && Object.keys(filterValues).length > 0;
  const isMobile = useIsMobile();

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
    <>
      <MobilePageTitle title="Progetti" />
      {!isMobile && (
        <div className="flex justify-end mb-4">
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(v) => v && setViewMode(v as "list" | "kanban")}
          >
            <ToggleGroupItem value="list" aria-label="Vista lista">
              <ListIcon className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="kanban" aria-label="Vista kanban">
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      )}
      {viewMode === "kanban" && !isMobile ? (
        <ProjectKanbanView />
      ) : (
        <div className="mt-4 flex flex-col md:flex-row md:gap-8">
          <ProjectListFilter />
          <div className="w-full flex flex-col gap-4">
            <ProjectListContent />
          </div>
        </div>
      )}
    </>
  );
};

const ProjectListActions = ({
  exporter,
  columns,
  visibleKeys,
  toggleColumn,
}: {
  exporter: Exporter<Project>;
  columns: typeof PROJECT_COLUMNS;
  visibleKeys: string[];
  toggleColumn: (key: string) => void;
}) => {
  const isMobile = useIsMobile();
  return (
    <TopToolbar className={isMobile ? "justify-center" : undefined}>
      {isMobile && <ProjectMobileFilter />}
      <SortButton fields={["name", "start_date", "created_at"]} />
      <ColumnVisibilityButton
        columns={columns}
        visibleKeys={visibleKeys}
        toggleColumn={toggleColumn}
      />
      <ExportButton exporter={exporter} />
      <CreateButton />
    </TopToolbar>
  );
};
