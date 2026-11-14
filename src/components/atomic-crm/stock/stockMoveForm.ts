import type { Identifier } from "ra-core";

/** What the person picks; adjustments are split by their direction. */
export const FORM_KINDS = [
  "receipt",
  "issue",
  "transfer",
  "adjustment_in",
  "adjustment_out",
] as const;
export type FormKind = (typeof FORM_KINDS)[number];

export interface MoveForm {
  kind: FormKind;
  product_id: Identifier;
  from_warehouse_id?: Identifier | null;
  to_warehouse_id?: Identifier | null;
  quantity: number;
  unit_cost?: number | null;
  counterparty_id?: Identifier | null;
  note?: string | null;
}

export const takesFrom = (kind: FormKind) =>
  kind === "issue" || kind === "transfer" || kind === "adjustment_out";
export const takesTo = (kind: FormKind) =>
  kind === "receipt" || kind === "transfer" || kind === "adjustment_in";

/** The row the database expects, without the fields this kind does not use. */
export const toStockMove = (values: MoveForm) => {
  const kind = values.kind;
  return {
    kind: kind.startsWith("adjustment") ? "adjustment" : kind,
    product_id: values.product_id,
    from_warehouse_id: takesFrom(kind) ? values.from_warehouse_id : null,
    to_warehouse_id: takesTo(kind) ? values.to_warehouse_id : null,
    quantity: values.quantity,
    unit_cost: kind === "receipt" ? values.unit_cost : null,
    counterparty_id:
      kind === "receipt" ? (values.counterparty_id ?? null) : null,
    note: values.note || null,
  };
};
