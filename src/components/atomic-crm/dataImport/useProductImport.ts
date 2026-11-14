import { useCallback } from "react";
import { useDataProvider, type Identifier } from "ra-core";

import { toMinor } from "../money/money";
import {
  PRODUCT_KINDS,
  UNIT_CODES,
  isStocked,
  type ProductKind,
  type UnitCode,
} from "../products/productOptions";
import type { Product, TaxRate } from "../products/types";
import { useTaxRates, useWarehouseChoices } from "../products/useStockData";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { createEachRow } from "./createEachRow";
import { toNumber, toText } from "./parseCell";
import type { ImportCell, ImportRow, ProcessImportBatch } from "./types";

/** Words people write in a CSV for each kind and unit, besides the codes. */
const KIND_WORDS: Record<string, ProductKind> = {
  товар: "goods",
  послуга: "service",
  матеріал: "material",
  product: "goods",
  material: "material",
  service: "service",
  goods: "goods",
};
const UNIT_WORDS: Record<string, UnitCode> = {
  шт: "pcs",
  кг: "kg",
  г: "g",
  л: "l",
  мл: "ml",
  м: "m",
  "м²": "m2",
  м2: "m2",
  год: "h",
  уп: "pack",
  pc: "pcs",
  piece: "pcs",
  hour: "h",
};

export const toKind = (cell: ImportCell): ProductKind => {
  const text = toText(cell)?.toLowerCase() ?? "";
  return (PRODUCT_KINDS as readonly string[]).includes(text)
    ? (text as ProductKind)
    : (KIND_WORDS[text] ?? "goods");
};

export const toUnit = (cell: ImportCell, kind: ProductKind): UnitCode => {
  const text = toText(cell)?.toLowerCase().replace(/\.$/, "") ?? "";
  if ((UNIT_CODES as readonly string[]).includes(text)) return text as UnitCode;
  return UNIT_WORDS[text] ?? (kind === "service" ? "service" : "pcs");
};

/** "20", "20%" or "standard" → the code of that VAT rate of the country pack. */
export const toVatRateCode = (
  cell: ImportCell,
  rates: TaxRate[],
): string | undefined => {
  const text = toText(cell)?.replace("%", "").trim().toLowerCase();
  if (!text) return undefined;
  return rates.find(
    (rate) =>
      rate.code === text ||
      Number(rate.rate) === Number(text.replace(",", ".")),
  )?.code;
};

/** Several barcodes in one cell, separated by ";" or spaces. */
export const toBarcodes = (cell: ImportCell): string[] =>
  (toText(cell)?.split(/[;,\s]+/) ?? []).filter(Boolean);

/** A decimal written with a comma ("12,5") or a dot. */
const toDecimal = (cell: ImportCell): number | undefined =>
  typeof cell === "string" ? toNumber(cell.replace(",", ".")) : toNumber(cell);

/**
 * Creates a product per CSV row (TZ stage 2: "100 products imported"). The
 * opening_stock column becomes a receipt into the default warehouse, at the
 * cost column (the purchase price of one unit).
 */
export function useProductImport(): ProcessImportBatch {
  const dataProvider = useDataProvider();
  const { currency } = useConfigurationContext();
  const taxRates = useTaxRates();
  const { choices } = useWarehouseChoices();
  const defaultWarehouseId: Identifier | undefined = choices[0]?.id;

  return useCallback(
    (batch: ImportRow[]) =>
      createEachRow(
        batch.map(async (row) => {
          const kind = toKind(row.kind);
          const price = toDecimal(row.price);
          const { data: product } = await dataProvider.create<Product>(
            "products",
            {
              data: {
                kind,
                name: toText(row.name),
                sku: toText(row.sku) ?? null,
                unit_code: toUnit(row.unit, kind),
                price: price === undefined ? null : toMinor(price, currency),
                vat_rate_code: toVatRateCode(row.vat_rate, taxRates) ?? null,
                barcodes: toBarcodes(row.barcode),
                description: toText(row.description) ?? null,
              },
            },
          );
          const openingStock = toDecimal(row.opening_stock);
          if (
            openingStock &&
            openingStock > 0 &&
            isStocked(kind) &&
            defaultWarehouseId != null
          ) {
            await dataProvider.create("stock_moves", {
              data: {
                kind: "receipt",
                product_id: product.id,
                to_warehouse_id: defaultWarehouseId,
                quantity: openingStock,
                unit_cost: toMinor(toDecimal(row.cost) ?? 0, currency),
                note: "CSV",
              },
            });
          }
        }),
      ),
    [currency, dataProvider, defaultWarehouseId, taxRates],
  );
}
