import type { Identifier } from "ra-core";

import type { Product } from "../products/types";

/** A product counted during an inventory, with the quantity found. */
export interface CountedLine {
  product: Product;
  counted: number;
}

/**
 * Scanning a product adds it with a count of 1, scanning it again adds one
 * more; the latest scanned product comes first. Returns a new list.
 */
export const addCount = (
  lines: CountedLine[],
  product: Product,
): CountedLine[] => {
  const existing = lines.find((line) => line.product.id === product.id);
  const rest = lines.filter((line) => line.product.id !== product.id);
  return [{ product, counted: existing ? existing.counted + 1 : 1 }, ...rest];
};

export const changeCount = (
  lines: CountedLine[],
  productId: Identifier,
  counted: number,
): CountedLine[] =>
  lines.map((line) =>
    line.product.id === productId ? { ...line, counted } : line,
  );

export const removeCount = (
  lines: CountedLine[],
  productId: Identifier,
): CountedLine[] => lines.filter((line) => line.product.id !== productId);
