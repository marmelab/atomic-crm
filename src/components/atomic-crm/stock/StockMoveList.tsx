import { useTranslate } from "ra-core";
import { CreateButton } from "@/components/admin/create-button";
import { DataTable } from "@/components/admin/data-table";
import { DateField } from "@/components/admin/date-field";
import { List } from "@/components/admin/list";
import { ReferenceField } from "@/components/admin/reference-field";
import { SelectInput } from "@/components/admin/select-input";

import { TopToolbar } from "../layout/TopToolbar";
import { MOVE_KINDS } from "../products/productOptions";
import {
  MoveCostField,
  MoveKindField,
  MoveQuantityField,
  MoveRouteField,
  ReverseMoveButton,
  ReversedMovesProvider,
} from "./MoveFields";

const StockMoveListActions = () => (
  <TopToolbar>
    <CreateButton label="resources.stock_moves.action.new" />
  </TopToolbar>
);

const useFilters = () => {
  const translate = useTranslate();
  return [
    <SelectInput
      key="kind"
      source="kind"
      alwaysOn
      choices={MOVE_KINDS.map((kind) => ({
        id: kind,
        name: translate(`crm.stock.kinds.${kind}`),
      }))}
      emptyText={translate("crm.stock.all_kinds")}
      helperText={false}
    />,
  ];
};

/** The stock journal: every move, newest first; a move is cancelled, never edited. */
export const StockMoveList = () => (
  <List
    filters={useFilters()}
    actions={<StockMoveListActions />}
    sort={{ field: "id", order: "DESC" }}
    perPage={50}
  >
    <ReversedMovesProvider>
      <MovesTable />
    </ReversedMovesProvider>
  </List>
);

export const MovesTable = ({
  showProduct = true,
}: {
  showProduct?: boolean;
}) => (
  <DataTable bulkActionButtons={false} rowClick={false}>
    <DataTable.Col source="moved_at">
      <DateField source="moved_at" showTime />
    </DataTable.Col>
    <DataTable.Col source="kind">
      <MoveKindField />
    </DataTable.Col>
    {showProduct ? (
      <DataTable.Col source="product_id">
        <ReferenceField source="product_id" reference="products" link="show" />
      </DataTable.Col>
    ) : null}
    <DataTable.Col
      source="from_warehouse_id"
      label="resources.stock_moves.fields.warehouse"
    >
      <MoveRouteField />
    </DataTable.Col>
    <DataTable.Col source="quantity" className="text-right">
      <MoveQuantityField />
    </DataTable.Col>
    <DataTable.Col source="unit_cost" className="text-right">
      <MoveCostField />
    </DataTable.Col>
    <DataTable.Col source="note" />
    <DataTable.Col label={false}>
      <ReverseMoveButton />
    </DataTable.Col>
  </DataTable>
);
