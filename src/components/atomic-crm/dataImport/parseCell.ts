import type { DealCategoryAmount, LabeledValue } from "../types";
import type { ImportCell } from "./types";

/** Trimmed cell content, or undefined when the cell is empty. */
export const toText = (cell: ImportCell): string | undefined => {
  if (cell == null) return undefined;
  const text = String(cell).trim();
  return text === "" ? undefined : text;
};

/** Cell content as a number, or undefined when it is empty or not numeric. */
export const toNumber = (cell: ImportCell): number | undefined => {
  const text = toText(cell);
  if (text === undefined) return undefined;
  const value = Number(text);
  return Number.isFinite(value) ? value : undefined;
};

/** Cell content as a number rounded to cents, or undefined like `toNumber`. */
const toCents = (cell: ImportCell): number | undefined => {
  const value = toNumber(cell);
  return value === undefined ? undefined : Math.round(value * 100) / 100;
};

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Cell content as an ISO 8601 date, or undefined when it is empty or is not a
 * plain `YYYY-MM-DD` date — the format the sample CSV documents.
 *
 * Only that format is accepted because `new Date(text)` reads anything else as
 * local midnight: in a timezone ahead of UTC, `09/30/2026` becomes
 * `2026-09-29T22:00:00Z`, which a `date` column truncates to the day before.
 * `dealUtils.formatISODateString` refuses `new Date` for the same reason on the
 * read path.
 */
export const toIsoDate = (cell: ImportCell): string | undefined => {
  const text = toText(cell);
  if (text === undefined || !isoDateRegex.test(text)) return undefined;
  // Parsed as UTC midnight, so the stored day is the one the CSV names
  const date = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return undefined;
  // An impossible day rolls over rather than failing — "2026-02-31" becomes
  // March 3 — so the parsed date has to name the day back
  const iso = date.toISOString();
  return iso.startsWith(text) ? iso : undefined;
};

/**
 * Cell content matched against configured options, so a CSV may carry either the
 * stored value ("proposal-sent") or the label users see ("Proposal Sent").
 * Returns undefined when the cell is empty or matches no option.
 */
export const toConfiguredValue = (
  cell: ImportCell,
  options: LabeledValue[],
): string | undefined => {
  const text = toText(cell)?.toLowerCase();
  if (text === undefined) return undefined;
  return options.find(
    (option) =>
      option.value.toLowerCase() === text ||
      option.label.toLowerCase() === text,
  )?.value;
};

/**
 * An amount as users write it: "$8,000", "8 000", "8.000,50". Currency symbols
 * and spaces go, a comma or dot before three digits is a thousands separator
 * (amounts never carry three decimals), any other comma is the decimal one.
 *
 * A separator repeated in the integer part must group digits — "1,234,567",
 * "1.234.567,89", or the Indian "1,23,456" — and is dropped; otherwise the
 * amount is unreadable, rather than "1,23,456" silently becoming 1.23.
 */
const toAmount = (text: string): number | undefined => {
  const compact = text.replace(/[\s$€£¥]/g, "");
  // the last group has 3 digits and the decimal separator differs from the
  // grouping one: "1.000.00" is 1000.00, not 100000
  const grouped = /^-?\d{1,3}([.,])(\d{2,3}\1)*\d{3}((?!\1)[.,]\d+)?$/.exec(
    compact,
  );
  const integerPart = compact.replace(/[.,]\d+$/, "");
  if (!grouped && /([.,]).*\1/.test(integerPart)) return undefined;
  return toCents(
    (grouped ? compact.replaceAll(grouped[1], "") : compact)
      .replace(/[.,](?=\d{3}(\D|$))/g, "")
      .replace(",", "."),
  );
};

/**
 * `toAmount` of a cell, undefined when it is empty. Throws on an unreadable
 * amount: that fails the row, which the import report counts, rather than
 * silently importing the deal without this money.
 */
const toRequiredAmount = (
  cell: ImportCell,
  source: string,
): number | undefined => {
  const text = toText(cell);
  if (text === undefined) return undefined;
  const amount = toAmount(text);
  if (amount === undefined) {
    throw new Error(`Cannot read the amount of "${source}"`);
  }
  return amount;
};

/** One `category:amount` part; the amount is optional. */
const toCategoryAmount = (
  part: string,
  options: LabeledValue[],
): { category: string | null; amount: number | undefined } => {
  const separator = part.lastIndexOf(":");
  // A label may itself contain ":" ("Phase 1: Discovery"), so a whole-part
  // match wins, and a digitless end is part of the name, not an amount
  const wholeMatch = toConfiguredValue(part, options);
  if (separator === -1 && wholeMatch === undefined) {
    // "8000" alone is an uncategorized amount
    const amount = toAmount(part);
    if (amount !== undefined) return { category: null, amount };
    // "Website design 8000", a forgotten ":", throws rather than losing its
    // money; an unknown label like "Phase 2" is only a name
    // Each label is tried as the prefix, so "Phase 2 500" finds "Phase 2"
    const text = part.trim().toLowerCase();
    const forgottenColon = options
      .flatMap(({ value, label }) => [value, label])
      .some(
        (name) =>
          text.startsWith(name.toLowerCase()) &&
          /^\s+[\d$€£¥][\d\s.,$€£¥]*$/.test(text.slice(name.length)),
      );
    if (forgottenColon) {
      throw new Error(`Cannot read the amount of "${part.trim()}"`);
    }
  }
  if (
    separator === -1 ||
    wholeMatch !== undefined ||
    /^[^\d]+$/.test(part.slice(separator + 1).trim())
  ) {
    return { category: wholeMatch ?? null, amount: undefined };
  }
  return {
    category: toConfiguredValue(part.slice(0, separator), options) ?? null,
    amount: toRequiredAmount(part.slice(separator + 1), part.trim()),
  };
};

/**
 * Per-category amounts of a deal, from the `category:amount` parts the deals
 * export writes, separated by ";" (e.g. "Website design:8000;Copywriting:4000").
 * Each category is matched like `toConfiguredValue`; the amount is optional.
 *
 * Money is never dropped: a category matching no option keeps its amount as an
 * uncategorized line, and an unreadable amount throws. When no part carries an
 * amount, `totalCell` (the single-amount column of older files) goes to the
 * first line.
 */
export const toCategoryAmounts = (
  cell: ImportCell,
  totalCell: ImportCell,
  options: LabeledValue[],
): DealCategoryAmount[] => {
  const lines = (toText(cell) ?? "")
    .split(";")
    .filter((part) => part.trim() !== "")
    .map((part) => toCategoryAmount(part, options))
    .filter((line) => line.category !== null || line.amount !== undefined);

  const hasAmounts = lines.some((line) => line.amount !== undefined);
  // Only read when used, so an unreadable ignored cell does not fail the row
  const total = hasAmounts
    ? undefined
    : toRequiredAmount(totalCell, String(totalCell).trim());
  if (total !== undefined) {
    if (lines.length === 0) return [{ category: null, amount: total }];
    lines[0] = { ...lines[0], amount: total };
  }
  return lines.map((line) => ({ ...line, amount: line.amount ?? 0 }));
};

/**
 * The one category line of an older deals file, from its single `category` and
 * `amount` columns. The category is a whole label, never split on ":", so
 * "Q3: 2026" is not read as an amount.
 */
export const toLegacyCategoryAmounts = (
  categoryCell: ImportCell,
  amountCell: ImportCell,
  options: LabeledValue[],
): DealCategoryAmount[] => {
  const category = toConfiguredValue(categoryCell, options) ?? null;
  const amount = toRequiredAmount(amountCell, String(amountCell).trim());
  if (category === null && amount === undefined) return [];
  return [{ category, amount: amount ?? 0 }];
};
