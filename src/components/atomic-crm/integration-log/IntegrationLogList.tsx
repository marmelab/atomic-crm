import { useRecordContext } from "ra-core";
import { DataTable } from "@/components/admin/data-table";
import { ExportButton } from "@/components/admin/export-button";
import { List } from "@/components/admin/list";
import { Badge } from "@/components/ui/badge";

import { TopToolbar } from "../layout/TopToolbar";

const IntegrationLogActions = () => (
  <TopToolbar>
    <ExportButton />
  </TopToolbar>
);

const ResultField = (_props: { label?: string | boolean }) => {
  const record = useRecordContext();
  if (!record) return null;

  const result = record.result;
  const resultObject =
    typeof result === "object" && result !== null
      ? (result as Record<string, unknown>)
      : null;
  const isSuccess =
    resultObject?.status === "success" ||
    ["company_id", "contact_id", "deal_id"].some(
      (key) => resultObject?.[key] != null,
    );

  return (
    <Badge
      variant="outline"
      className={
        isSuccess
          ? "border-green-500 text-green-700 dark:text-green-400"
          : "border-red-500 text-red-700 dark:text-red-400"
      }
    >
      {isSuccess ? "success" : "failure"}
    </Badge>
  );
};

const SourceBadge = (_props: { label?: string | boolean }) => {
  const record = useRecordContext();
  if (!record) return null;

  const colorMap: Record<string, string> = {
    n8n: "border-orange-400 text-orange-700 dark:text-orange-300",
    edge_function:
      "border-purple-400 text-purple-700 dark:text-purple-300",
    "ingest-lead":
      "border-emerald-400 text-emerald-700 dark:text-emerald-300",
    crm: "border-blue-400 text-blue-700 dark:text-blue-300",
  };

  return (
    <Badge
      variant="outline"
      className={colorMap[record.source] ?? "border-gray-400"}
    >
      {record.source}
    </Badge>
  );
};

const TimestampField = (_props: { label?: string | boolean }) => {
  const record = useRecordContext();
  if (!record?.created_at) return null;

  const date = new Date(record.created_at);
  return (
    <span className="text-sm text-muted-foreground tabular-nums">
      {date.toLocaleDateString()} {date.toLocaleTimeString()}
    </span>
  );
};

export function IntegrationLogList() {
  return (
    <List
      title="Integration Log"
      actions={<IntegrationLogActions />}
      sort={{ field: "created_at", order: "DESC" }}
      perPage={25}
    >
      <DataTable bulkActionButtons={false}>
        <DataTable.Col source="source" label="Source">
          <SourceBadge />
        </DataTable.Col>
        <DataTable.Col source="action" />
        <DataTable.Col source="entity_type" label="Entity" />
        <DataTable.Col source="entity_id" label="Entity ID" />
        <DataTable.Col label="Result">
          <ResultField />
        </DataTable.Col>
        <DataTable.Col source="created_at" label="Timestamp">
          <TimestampField />
        </DataTable.Col>
      </DataTable>
    </List>
  );
}
