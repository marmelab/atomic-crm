import type { LabeledValue } from "../types";
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

/**
 * Cell content as a whole number, for the integer columns of the database: an
 * amount of `4500.50` would make PostgREST reject the whole row with
 * `invalid input syntax for type bigint`.
 */
export const toInteger = (cell: ImportCell): number | undefined => {
  const value = toNumber(cell);
  return value === undefined ? undefined : Math.round(value);
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
