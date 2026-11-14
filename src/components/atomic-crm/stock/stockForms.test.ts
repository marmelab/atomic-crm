import { describe, expect, it } from "vitest";

import type { Product } from "../products/types";
import { addCount, changeCount, removeCount } from "./inventoryCounts";
import { toStockMove } from "./stockMoveForm";

const product = (id: number, name: string): Product => ({
  id,
  name,
  kind: "goods",
  sku: null,
  unit_code: "pcs",
  price: null,
  currency: "UAH",
  vat_rate_code: null,
  barcodes: [],
  description: null,
  archived: false,
});

describe("stock move form", () => {
  const base = {
    product_id: 7,
    from_warehouse_id: 1,
    to_warehouse_id: 2,
    quantity: 3,
    unit_cost: 1250,
    counterparty_id: 9,
    note: "",
  };

  it("keeps the warehouse, cost and supplier of a receipt only", () => {
    expect(toStockMove({ ...base, kind: "receipt" })).toEqual({
      kind: "receipt",
      product_id: 7,
      from_warehouse_id: null,
      to_warehouse_id: 2,
      quantity: 3,
      unit_cost: 1250,
      counterparty_id: 9,
      note: null,
    });
  });

  it("takes an issue out of a warehouse, without cost or supplier", () => {
    expect(toStockMove({ ...base, kind: "issue" })).toMatchObject({
      kind: "issue",
      from_warehouse_id: 1,
      to_warehouse_id: null,
      unit_cost: null,
      counterparty_id: null,
    });
  });

  it("turns both correction directions into an adjustment", () => {
    expect(toStockMove({ ...base, kind: "adjustment_in" })).toMatchObject({
      kind: "adjustment",
      from_warehouse_id: null,
      to_warehouse_id: 2,
    });
    expect(toStockMove({ ...base, kind: "adjustment_out" })).toMatchObject({
      kind: "adjustment",
      from_warehouse_id: 1,
      to_warehouse_id: null,
    });
  });
});

describe("inventory counts", () => {
  it("adds a scanned product once and counts each further scan", () => {
    const shampoo = product(1, "Shampoo");
    const soap = product(2, "Soap");
    let lines = addCount([], shampoo);
    lines = addCount(lines, soap);
    lines = addCount(lines, shampoo);

    expect(lines.map((line) => [line.product.name, line.counted])).toEqual([
      ["Shampoo", 2],
      ["Soap", 1],
    ]);
  });

  it("changes or removes a counted line without touching the others", () => {
    const lines = addCount(addCount([], product(1, "A")), product(2, "B"));
    const changed = changeCount(lines, 1, 12.5);
    expect(changed.find((line) => line.product.id === 1)?.counted).toBe(12.5);
    expect(lines.find((line) => line.product.id === 1)?.counted).toBe(1);
    expect(removeCount(changed, 2).map((line) => line.product.id)).toEqual([1]);
  });
});
