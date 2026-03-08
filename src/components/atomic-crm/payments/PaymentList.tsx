import { useCallback } from "react";
import { useListContext, type Exporter } from "ra-core";
import { downloadCSVItalian } from "@/lib/downloadCsvItalian";
import { CreateButton } from "@/components/admin/create-button";
import { ExportButton } from "@/components/admin/export-button";
import { List } from "@/components/admin/list";
import { SortButton } from "@/components/admin/sort-button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";

import type { Client, Payment, Project } from "../types";
import { PaymentListContent } from "./PaymentListContent";
import { PaymentListFilter, PaymentMobileFilter } from "./PaymentListFilter";
import { TopToolbar } from "../layout/TopToolbar";
import { MobilePageTitle } from "../layout/MobilePageTitle";
import { paymentTypeLabels, paymentStatusLabels } from "./paymentTypes";
import { PAYMENT_COLUMNS, filterExportRow } from "../misc/columnDefinitions";
import { ColumnVisibilityButton } from "../misc/ColumnVisibilityButton";

export const PaymentList = () => {
  const { visibleKeys, columns, toggleColumn } = useColumnVisibility(
    "payments",
    PAYMENT_COLUMNS,
  );

  const exporter: Exporter<Payment> = useCallback(
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
      const rows = records.map((p) =>
        filterExportRow(
          {
            data: p.payment_date ?? "",
            cliente: clients[p.client_id]?.name ?? "",
            progetto: p.project_id ? (projects[p.project_id]?.name ?? "") : "",
            tipo: paymentTypeLabels[p.payment_type] ?? p.payment_type,
            importo: p.amount,
            rif_fattura: p.invoice_ref ?? "",
            stato: paymentStatusLabels[p.status] ?? p.status,
          },
          visibleKeys,
          columns,
        ),
      );
      downloadCSVItalian(rows, "pagamenti");
    },
    [visibleKeys, columns],
  );

  return (
    <List
      title={false}
      actions={
        <PaymentListActions
          exporter={exporter}
          columns={columns}
          visibleKeys={visibleKeys}
          toggleColumn={toggleColumn}
        />
      }
      perPage={25}
      sort={{ field: "payment_date", order: "DESC" }}
      exporter={exporter}
    >
      <PaymentListLayout />
    </List>
  );
};

const PaymentListLayout = () => {
  const { data, isPending, filterValues } = useListContext();
  const hasFilters = filterValues && Object.keys(filterValues).length > 0;

  if (isPending) return null;
  if (!data?.length && !hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground mb-4">Nessun pagamento</p>
        <CreateButton />
      </div>
    );
  }

  return (
    <>
      <MobilePageTitle title="Pagamenti" />
      <div className="mt-4 flex flex-col md:flex-row md:gap-8">
        <PaymentListFilter />
        <div className="w-full flex flex-col gap-4">
          <PaymentListContent />
        </div>
      </div>
    </>
  );
};

const PaymentListActions = ({
  exporter,
  columns,
  visibleKeys,
  toggleColumn,
}: {
  exporter: Exporter<Payment>;
  columns: typeof PAYMENT_COLUMNS;
  visibleKeys: string[];
  toggleColumn: (key: string) => void;
}) => {
  const isMobile = useIsMobile();
  return (
    <TopToolbar className={isMobile ? "justify-center" : undefined}>
      {isMobile && <PaymentMobileFilter />}
      <SortButton fields={["payment_date", "amount", "created_at"]} />
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
