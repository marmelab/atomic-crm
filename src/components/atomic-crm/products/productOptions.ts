/** Choices and formatting of products and stock (TZ section 5.6). */

export const PRODUCT_KINDS = ["goods", "service", "material"] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];

/** Codes of public.units, in the order of their sort_order */
export const UNIT_CODES = [
  "pcs",
  "kg",
  "g",
  "l",
  "ml",
  "m",
  "m2",
  "h",
  "pack",
  "service",
] as const;
export type UnitCode = (typeof UNIT_CODES)[number];

export const MOVE_KINDS = [
  "receipt",
  "issue",
  "transfer",
  "adjustment",
  "reversal",
] as const;
export type MoveKind = (typeof MOVE_KINDS)[number];

/** Only goods and materials are kept in stock; a service is not. */
export const isStocked = (kind: string | undefined): boolean =>
  kind !== "service";

/** "12,5" kg, "3" pcs: quantities keep up to 3 decimals, without trailing zeros. */
export const formatQuantity = (
  quantity: number | string | null | undefined,
  locale: string,
): string =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(
    Number(quantity ?? 0),
  );
