import {
  CreateButton,
  DataTable,
  ExportButton,
  List,
  SearchInput,
} from "@/components/admin";
import { Badge } from "@/components/ui/badge";
import { useRecordContext } from "ra-core";
import { TopToolbar } from "../layout/TopToolbar";

const SalesListActions = () => (
  <TopToolbar>
    <ExportButton />
    <CreateButton label="New user" />
  </TopToolbar>
);

const filters = [<SearchInput source="q" alwaysOn />];

const OptionsField = (_props: { label?: string | boolean }) => {
  const record = useRecordContext();
  if (!record) return null;
  return (
    <div className="flex flex-row gap-1">
      {record.administrator && (
        <Badge
          variant="outline"
          className="border-blue-300 dark:border-blue-700"
        >
          Admin
        </Badge>
      )}
      {record.disabled && (
        <Badge
          variant="outline"
          className="border-orange-300 dark:border-orange-700"
        >
          Disabled
        </Badge>
      )}
    </div>
  );
};

export function SalesList() {
  return (
    <List
      filters={filters}
      actions={<SalesListActions />}
      sort={{ field: "first_name", order: "ASC" }}
    >
      <DataTable>
        <DataTable.Col source="first_name" />
        <DataTable.Col source="last_name" />
        <DataTable.Col source="email" />
        <DataTable.Col label={false}>
          <OptionsField />
        </DataTable.Col>
      </DataTable>
    </List>
  );
}
