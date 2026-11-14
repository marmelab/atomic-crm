import { useLocaleState, useRecordContext, useTranslate } from "ra-core";
import { DataTable } from "@/components/admin/data-table";
import { List } from "@/components/admin/list";
import { ReferenceField } from "@/components/admin/reference-field";
import { SelectInput } from "@/components/admin/select-input";

import { formatQuantity } from "../products/productOptions";
import type { StockLevel } from "../products/types";
import { useWarehouseChoices } from "../products/useStockData";

const useFilters = () => {
  const translate = useTranslate();
  const { choices } = useWarehouseChoices();
  return [
    <SelectInput
      key="warehouse_id"
      source="warehouse_id"
      alwaysOn
      choices={choices}
      emptyText={translate("crm.stock.all_warehouses")}
      helperText={false}
    />,
  ];
};

/** What is in stock, per product and warehouse. */
export const StockLevelList = () => (
  <List
    filters={useFilters()}
    sort={{ field: "product_id", order: "ASC" }}
    perPage={100}
  >
    <DataTable bulkActionButtons={false} rowClick={false}>
      <DataTable.Col source="product_id">
        <ReferenceField source="product_id" reference="products" link="show" />
      </DataTable.Col>
      <DataTable.Col source="warehouse_id">
        <WarehouseNameField />
      </DataTable.Col>
      <DataTable.Col source="quantity" className="text-right">
        <LevelQuantityField />
      </DataTable.Col>
    </DataTable>
  </List>
);

const WarehouseNameField = () => {
  const record = useRecordContext<StockLevel>();
  const { choices } = useWarehouseChoices();
  if (!record) return null;
  return (
    <>{choices.find((choice) => choice.id === record.warehouse_id)?.name}</>
  );
};

const LevelQuantityField = () => {
  const record = useRecordContext<StockLevel>();
  const translate = useTranslate();
  const [locale = "uk"] = useLocaleState();
  if (!record) return null;
  return (
    <span className="tabular-nums whitespace-nowrap">
      {formatQuantity(record.quantity, locale)}{" "}
      {translate(`crm.units.${record.unit_code}`)}
    </span>
  );
};
