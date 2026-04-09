import { useRecordContext } from "ra-core";
import { CreateButton } from "@/components/admin/create-button";
import { DataTable } from "@/components/admin/data-table";
import { ExportButton } from "@/components/admin/export-button";
import { List } from "@/components/admin/list";
import { SearchInput } from "@/components/admin/search-input";

import { TopToolbar } from "../layout/TopToolbar";
import { formatPrice, getProductTypeLabel } from "./productUtils";

const ProductListActions = () => (
  <TopToolbar>
    <ExportButton />
    <CreateButton />
  </TopToolbar>
);

const filters = [<SearchInput source="q" alwaysOn />];

const TypeField = (_props: { label?: string | boolean }) => {
  const record = useRecordContext();
  if (!record) return null;
  return <span>{getProductTypeLabel(record.type)}</span>;
};

const PriceField = (_props: { label?: string | boolean }) => {
  const record = useRecordContext();
  if (!record) return null;
  return <span>{formatPrice(record.price)}</span>;
};

const ActiveField = (_props: { label?: string | boolean }) => {
  const record = useRecordContext();
  if (!record) return null;
  return <span>{record.active ? "Oui" : "Non"}</span>;
};

const ProductList = () => (
  <List
    filters={filters}
    actions={<ProductListActions />}
    sort={{ field: "reference", order: "ASC" }}
  >
    <DataTable>
      <DataTable.Col source="reference" />
      <DataTable.Col source="name" />
      <DataTable.Col source="type" label="Type">
        <TypeField />
      </DataTable.Col>
      <DataTable.Col source="price" label="Prix">
        <PriceField />
      </DataTable.Col>
      <DataTable.Col source="active" label="Actif">
        <ActiveField />
      </DataTable.Col>
    </DataTable>
  </List>
);

export default ProductList;
