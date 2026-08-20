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

/** Cell content as an ISO 8601 date, or undefined when it is empty or invalid. */
export const toIsoDate = (cell: ImportCell): string | undefined => {
  const text = toText(cell);
  if (text === undefined) return undefined;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
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
