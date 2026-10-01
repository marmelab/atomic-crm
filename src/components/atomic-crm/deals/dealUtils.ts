import { format } from "date-fns";

import type { DealCategoryAmount, DealStage, LabeledValue } from "../types";

export const findDealLabel = (dealStages: DealStage[], dealValue: string) => {
  const dealStage = dealStages.find((stage) => stage.value === dealValue);
  return dealStage?.label;
};

/** Labels of a deal's categories, comma-separated, falling back to the raw value */
export const formatDealCategories = (
  dealCategories: LabeledValue[],
  categories: string[] = [],
) =>
  categories
    .map((category) => findDealLabel(dealCategories, category) ?? category)
    .join(", ");

/** A deal's categories, each once, in the order of its category lines */
export const getDealCategories = (
  categoryAmounts: DealCategoryAmount[] = [],
) => [
  ...new Set(
    categoryAmounts
      .map((line) => line.category)
      .filter((category): category is string => !!category),
  ),
];

/** A deal's amount: the sum of its category amounts */
export const getDealAmount = (categoryAmounts: DealCategoryAmount[] = []) =>
  categoryAmounts.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);

/**
 * A deal's per-category amounts as one CSV cell, in the format the import reads:
 * "website-design:8000;copywriting:4000" (":500" for an uncategorized line).
 */
const toCents = (amount: number) => Math.round(amount * 100) / 100;

export const formatCategoryAmounts = (
  categoryAmounts: DealCategoryAmount[] = [],
) =>
  categoryAmounts
    // Cents only: the import reads a dot before three digits as thousands
    .map((line) => `${line.category ?? ""}:${toCents(line.amount)}`)
    .join(";");

/**
 * Deals used to be filtered on a single `category` column, dropped when deals
 * got several categories. List params persisted in the store and bookmarked
 * URLs may still carry it: PostgREST would answer 400 on the missing column,
 * with no filter input left to clear it. Maps it to the `categories` filter.
 */
export const mapLegacyCategoryFilter = <Params extends { filter?: any }>(
  params: Params,
): Params => {
  if (!params.filter || !("category" in params.filter)) return params;
  const { category, ...filter } = params.filter;
  return {
    ...params,
    // a categories filter the user picked wins over the stale one
    filter: category ? { "categories@cs": `{${category}}`, ...filter } : filter,
  };
};

/**
 * Values of the categories whose label or stored value contains a word of the
 * search text, as the other searched fields match word by word
 */
export const findDealCategoriesMatching = (
  dealCategories: LabeledValue[],
  search: string,
) => {
  const words = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return dealCategories
    .filter(({ value, label }) =>
      words.some(
        (word) =>
          value.toLowerCase().includes(word) ||
          label.toLowerCase().includes(word),
      ),
    )
    .map(({ value }) => value);
};

export function getRelativeTimeString(
  dateString: string,
  locale = "en",
): string {
  const date = new Date(dateString);
  date.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diff = date.getTime() - today.getTime();
  const unitDiff = Math.round(diff / (1000 * 60 * 60 * 24));

  // Check if the date is more than one week old
  if (Math.abs(unitDiff) > 7) {
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "long",
    }).format(date);
  }

  // Intl.RelativeTimeFormat for dates within the last week
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  return ucFirst(rtf.format(unitDiff, "day"));
}

function ucFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

const isoDateStringRegex = /^\d{4}-\d{2}-\d{2}$/;

export function formatISODateString(dateString: string) {
  if (!isoDateStringRegex.test(dateString)) {
    throw new Error("Invalid date format. Expected YYYY-MM-DD.");
  }
  // Some browsers will consider a date in the format YYYY-MM-DD as UTC, which can cause off-by-one-day issues depending on the user's timezone.
  // To avoid this, we can parse the date components manually and create a date object in the local timezone.
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return format(date, "PP");
}
