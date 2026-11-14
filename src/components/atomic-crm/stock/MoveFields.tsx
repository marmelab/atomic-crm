import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useDataProvider,
  useGetList,
  useListContext,
  useLocaleState,
  useNotify,
  useRecordContext,
  useTranslate,
  type Identifier,
} from "ra-core";
import { createContext, useContext, type ReactNode } from "react";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";

import { formatMoney } from "../money/money";
import { formatQuantity } from "../products/productOptions";
import type { StockMove } from "../products/types";
import { useWarehouseChoices } from "../products/useStockData";
import type { CrmDataProvider } from "../providers/types";
import { useConfigurationContext } from "../root/ConfigurationContext";

/** "Прихід", "Списання"... */
export const MoveKindField = () => {
  const record = useRecordContext<StockMove>();
  const translate = useTranslate();
  if (!record) return null;
  return <>{translate(`crm.stock.kinds.${record.kind}`)}</>;
};

/** "Основний склад → Магазин", or one warehouse with the direction sign. */
export const MoveRouteField = () => {
  const record = useRecordContext<StockMove>();
  const { choices } = useWarehouseChoices();
  if (!record) return null;
  const name = (id: Identifier | null) =>
    choices.find((choice) => choice.id === id)?.name ?? "";
  if (record.from_warehouse_id && record.to_warehouse_id) {
    return (
      <span>
        {name(record.from_warehouse_id)} → {name(record.to_warehouse_id)}
      </span>
    );
  }
  return (
    <span>{name(record.to_warehouse_id ?? record.from_warehouse_id)}</span>
  );
};

/** "+10" into a warehouse, "−2" out of it, "5" between two. */
export const MoveQuantityField = () => {
  const record = useRecordContext<StockMove>();
  const [locale = "uk"] = useLocaleState();
  if (!record) return null;
  const sign =
    record.from_warehouse_id && record.to_warehouse_id
      ? ""
      : record.to_warehouse_id
        ? "+"
        : "−";
  const color =
    sign === "+" ? "text-primary" : sign === "−" ? "text-destructive" : "";
  return (
    <span className={`tabular-nums whitespace-nowrap ${color}`}>
      {sign}
      {formatQuantity(record.quantity, locale)}
    </span>
  );
};

export const MoveCostField = () => {
  const record = useRecordContext<StockMove>();
  const { locale } = useConfigurationContext();
  if (record?.unit_cost == null) return null;
  return (
    <span className="tabular-nums whitespace-nowrap">
      {formatMoney(record.unit_cost, record.currency, locale)}
    </span>
  );
};

const ReversedMovesContext = createContext<Set<Identifier>>(new Set());

/**
 * Knows which moves of the current list page were already reversed, so that
 * their "Cancel" button is not offered.
 */
export const ReversedMovesProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const { data = [] } = useListContext<StockMove>();
  const ids = data.map((move) => move.id);
  const { data: reversals = [] } = useGetList<StockMove>(
    "stock_moves",
    {
      pagination: { page: 1, perPage: ids.length || 1 },
      sort: { field: "id", order: "ASC" },
      filter: { "reverses_id@in": `(${ids.join(",")})` },
    },
    { enabled: ids.length > 0 },
  );
  return (
    <ReversedMovesContext.Provider
      value={new Set(reversals.map((move) => move.reverses_id as Identifier))}
    >
      {children}
    </ReversedMovesContext.Provider>
  );
};

/** Cancels a move with a reversal; posted moves are never edited. */
export const ReverseMoveButton = () => {
  const record = useRecordContext<StockMove>();
  const reversed = useContext(ReversedMovesContext);
  const translate = useTranslate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { mutate, isPending } = useMutation({
    mutationFn: (id: Identifier) => dataProvider.reverseStockMove(id),
    onSuccess: () => {
      notify("crm.stock.reversed", { type: "success" });
      queryClient.invalidateQueries();
    },
    onError: (error: Error) =>
      notify(
        error.message.includes("Not enough stock")
          ? "crm.stock.not_enough"
          : "crm.stock.reverse_failed",
        { type: "error" },
      ),
  });

  if (!record || record.kind === "reversal") return null;
  if (reversed.has(record.id)) {
    return (
      <span className="text-sm text-muted-foreground">
        {translate("crm.stock.was_reversed")}
      </span>
    );
  }
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={(event) => {
        event.stopPropagation();
        if (window.confirm(translate("crm.stock.reverse_confirm"))) {
          mutate(record.id);
        }
      }}
    >
      <Undo2 />
      {translate("crm.stock.reverse")}
    </Button>
  );
};
