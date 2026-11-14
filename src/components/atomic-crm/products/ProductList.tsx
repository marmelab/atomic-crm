import { useLocaleState, useRecordContext, useTranslate } from "ra-core";
import { CreateButton } from "@/components/admin/create-button";
import { DataTable } from "@/components/admin/data-table";
import { List } from "@/components/admin/list";
import { SearchInput } from "@/components/admin/search-input";
import { SelectInput } from "@/components/admin/select-input";

import { DataImportButton } from "../dataImport/DataImportButton";
import { TopToolbar } from "../layout/TopToolbar";
import { formatMoney } from "../money/money";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { formatQuantity, isStocked, PRODUCT_KINDS } from "./productOptions";
import type { Product } from "./types";

const ProductListActions = () => (
  <TopToolbar>
    <DataImportButton resource="products" />
    <CreateButton label="resources.products.action.new" />
  </TopToolbar>
);

const useFilters = () => {
  const translate = useTranslate();
  return [
    <SearchInput key="q" source="q" alwaysOn />,
    <SelectInput
      key="kind"
      source="kind"
      alwaysOn
      choices={PRODUCT_KINDS.map((kind) => ({
        id: kind,
        name: translate(`crm.products.kinds.${kind}`),
      }))}
      emptyText={translate("crm.products.all_kinds")}
      helperText={false}
    />,
  ];
};

/** The catalog: name, article, kind, stock and price of every product. */
export const ProductList = () => (
  <List
    filters={useFilters()}
    filterDefaultValues={{ archived: false }}
    actions={<ProductListActions />}
    sort={{ field: "name", order: "ASC" }}
    perPage={50}
  >
    <DataTable bulkActionButtons={false} rowClick="show">
      <DataTable.Col source="name" />
      <DataTable.Col source="sku" />
      <DataTable.Col source="kind">
        <KindField />
      </DataTable.Col>
      <DataTable.Col source="quantity" className="text-right">
        <QuantityField />
      </DataTable.Col>
      <DataTable.Col source="price" className="text-right">
        <PriceField />
      </DataTable.Col>
    </DataTable>
  </List>
);

const KindField = () => {
  const record = useRecordContext<Product>();
  const translate = useTranslate();
  if (!record) return null;
  return <>{translate(`crm.products.kinds.${record.kind}`)}</>;
};

export const QuantityField = () => {
  const record = useRecordContext<Product>();
  const translate = useTranslate();
  const [locale = "uk"] = useLocaleState();
  if (!record || !isStocked(record.kind)) return null;
  return (
    <span className="whitespace-nowrap tabular-nums">
      {formatQuantity(record.quantity, locale)}{" "}
      {translate(`crm.units.${record.unit_code}`)}
    </span>
  );
};

const PriceField = () => {
  const record = useRecordContext<Product>();
  const { locale } = useConfigurationContext();
  if (record?.price == null) return null;
  return (
    <span className="whitespace-nowrap tabular-nums">
      {formatMoney(record.price, record.currency, locale)}
    </span>
  );
};
