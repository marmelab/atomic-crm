import { useCallback } from "react";
import { useListContext, type Exporter } from "ra-core";
import { downloadCSVItalian } from "@/lib/downloadCsvItalian";
import { CreateButton } from "@/components/admin/create-button";
import { ExportButton } from "@/components/admin/export-button";
import { List } from "@/components/admin/list";
import { SortButton } from "@/components/admin/sort-button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";

import type { Client, Expense, Project, Supplier } from "../types";
import { ExpenseListContent } from "./ExpenseListContent";
import { ExpenseListFilter, ExpenseMobileFilter } from "./ExpenseListFilter";
import { TopToolbar } from "../layout/TopToolbar";
import { MobilePageTitle } from "../layout/MobilePageTitle";
import { expenseTypeLabels } from "./expenseTypes";
import { calculateKmReimbursement } from "@/lib/semantics/crmSemanticRegistry";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { EXPENSE_COLUMNS, filterExportRow } from "../misc/columnDefinitions";
import { ColumnVisibilityButton } from "../misc/ColumnVisibilityButton";

export const ExpenseList = () => {
  const { operationalConfig } = useConfigurationContext();
  const { visibleKeys, columns, toggleColumn } = useColumnVisibility(
    "expenses",
    EXPENSE_COLUMNS,
  );
  const defaultKmRate = operationalConfig.defaultKmRate;

  const exporter: Exporter<Expense> = useCallback(
    async (records, fetchRelatedRecords) => {
      const clients = await fetchRelatedRecords<Client>(
        records,
        "client_id",
        "clients",
      );
      const projects = await fetchRelatedRecords<Project>(
        records,
        "project_id",
        "projects",
      );
      const supplierRecords = await fetchRelatedRecords<Supplier>(
        records,
        "supplier_id",
        "suppliers",
      );
      const rows = records.map((e) =>
        filterExportRow(
          {
            data: e.expense_date,
            cliente: e.client_id ? (clients[e.client_id]?.name ?? "") : "",
            fornitore: e.supplier_id
              ? (supplierRecords[e.supplier_id]?.name ?? "")
              : "",
            progetto: e.project_id ? (projects[e.project_id]?.name ?? "") : "",
            tipo: expenseTypeLabels[e.expense_type] ?? e.expense_type,
            km: e.km_distance ?? "",
            tariffa_km: e.km_rate ?? "",
            importo: e.amount ?? "",
            ricarico_percent: e.markup_percent ?? "",
            totale: computeTotal(e, defaultKmRate),
            descrizione: e.description ?? "",
            rif_fattura: e.invoice_ref ?? "",
          },
          visibleKeys,
          columns,
        ),
      );
      downloadCSVItalian(rows, "spese");
    },
    [visibleKeys, columns, defaultKmRate],
  );

  return (
    <List
      title={false}
      actions={
        <ExpenseListActions
          exporter={exporter}
          columns={columns}
          visibleKeys={visibleKeys}
          toggleColumn={toggleColumn}
        />
      }
      perPage={25}
      sort={{ field: "expense_date", order: "DESC" }}
      exporter={exporter}
    >
      <ExpenseListLayout />
    </List>
  );
};

const ExpenseListLayout = () => {
  const { data, isPending, filterValues } = useListContext();
  const hasFilters = filterValues && Object.keys(filterValues).length > 0;

  if (isPending) return null;
  if (!data?.length && !hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground mb-4">Nessuna spesa</p>
        <CreateButton />
      </div>
    );
  }

  return (
    <>
      <MobilePageTitle title="Spese" />
      <div className="mt-4 flex flex-col md:flex-row md:gap-8">
        <ExpenseListFilter />
        <div className="w-full flex flex-col gap-4">
          <ExpenseListContent />
        </div>
      </div>
    </>
  );
};

const ExpenseListActions = ({
  exporter,
  columns,
  visibleKeys,
  toggleColumn,
}: {
  exporter: Exporter<Expense>;
  columns: typeof EXPENSE_COLUMNS;
  visibleKeys: string[];
  toggleColumn: (key: string) => void;
}) => {
  const isMobile = useIsMobile();
  return (
    <TopToolbar className={isMobile ? "justify-center" : undefined}>
      {isMobile && <ExpenseMobileFilter />}
      <SortButton fields={["expense_date", "created_at"]} />
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

const computeTotal = (e: Expense, defaultKmRate: number) => {
  if (e.expense_type === "credito_ricevuto") {
    return -(e.amount ?? 0);
  }
  if (e.expense_type === "spostamento_km") {
    return calculateKmReimbursement({
      kmDistance: e.km_distance,
      kmRate: e.km_rate,
      defaultKmRate,
    });
  }
  return (e.amount ?? 0) * (1 + (e.markup_percent ?? 0) / 100);
};
