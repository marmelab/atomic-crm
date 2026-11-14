import { required, useRecordContext, useTranslate } from "ra-core";
import { Create } from "@/components/admin/create";
import { CreateButton } from "@/components/admin/create-button";
import { DataTable } from "@/components/admin/data-table";
import { Edit } from "@/components/admin/edit";
import { List } from "@/components/admin/list";
import { SimpleForm } from "@/components/admin/simple-form";
import { TextInput } from "@/components/admin/text-input";
import { BooleanInput } from "@/components/admin/boolean-input";
import { Badge } from "@/components/ui/badge";

import { TopToolbar } from "../layout/TopToolbar";
import type { Warehouse } from "../products/types";
import { useWarehouseName } from "../products/useStockData";

/** Warehouses of the business; a used warehouse is archived, never deleted. */
export const WarehouseList = () => (
  <List
    actions={
      <TopToolbar>
        <CreateButton label="resources.warehouses.action.new" />
      </TopToolbar>
    }
    sort={{ field: "id", order: "ASC" }}
    pagination={false}
  >
    <DataTable bulkActionButtons={false} rowClick="edit">
      <DataTable.Col source="name">
        <WarehouseNameField />
      </DataTable.Col>
    </DataTable>
  </List>
);

const WarehouseNameField = () => {
  const record = useRecordContext<Warehouse>();
  const warehouseName = useWarehouseName();
  const translate = useTranslate();
  if (!record) return null;
  return (
    <span className="flex items-center gap-2">
      {warehouseName(record)}
      {record.is_default ? (
        <Badge variant="secondary">{translate("crm.stock.default")}</Badge>
      ) : null}
      {record.archived ? (
        <Badge variant="outline">{translate("crm.stock.archived")}</Badge>
      ) : null}
    </span>
  );
};

export const WarehouseCreate = () => (
  <Create redirect="list">
    <SimpleForm>
      <TextInput source="name" validate={required()} helperText={false} />
    </SimpleForm>
  </Create>
);

export const WarehouseEdit = () => (
  <Edit redirect="list" mutationMode="pessimistic">
    <WarehouseEditForm />
  </Edit>
);

const WarehouseEditForm = () => {
  const record = useRecordContext<Warehouse>();
  return (
    <SimpleForm>
      <TextInput
        source="name"
        // The default warehouse may keep the name the interface gives it
        validate={record?.is_default ? undefined : required()}
        helperText={false}
      />
      {record?.is_default ? null : (
        <BooleanInput source="archived" helperText={false} />
      )}
    </SimpleForm>
  );
};
