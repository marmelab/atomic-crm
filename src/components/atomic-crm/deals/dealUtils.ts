import { format } from "date-fns";

import type { DealStage, LabeledValue } from "../types";

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
    filter: category ? { ...filter, "categories@cs": `{${category}}` } : filter,
  };
};

/** Values of the categories whose label or stored value contains the search text */
export const findDealCategoriesMatching = (
  dealCategories: LabeledValue[],
  search: string,
) => {
  const text = search.toLowerCase();
  return dealCategories
    .filter(
      ({ value, label }) =>
        value.toLowerCase().includes(text) ||
        label.toLowerCase().includes(text),
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
