import { format } from "date-fns";

import type { DealStage, LabeledValue } from "../types";

export const findDealLabel = (dealStages: DealStage[], dealValue: string) => {
  const dealStage = dealStages.find((stage) => stage.value === dealValue);
  return dealStage?.label;
};

export const formatDealCategories = (
  dealCategories: LabeledValue[],
  categories: string[] | null | undefined,
): string =>
  (categories ?? [])
    .map(
      (value) => dealCategories.find((c) => c.value === value)?.label ?? value,
    )
    .join(", ");

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

export const isISODateString = (value: unknown): value is string =>
  typeof value === "string" && isoDateStringRegex.test(value);

// Keep in sync with the deals_expected_closing_date_year check in supabase/schemas/01_tables.sql
export const MIN_CLOSING_YEAR = 1900;
export const MAX_CLOSING_YEAR = 2099;

export const isClosingYearInRange = (date: string) => {
  const year = Number(date.split("-")[0]);
  return year >= MIN_CLOSING_YEAR && year <= MAX_CLOSING_YEAR;
};

/** Form validator: an empty value is left to `required()`. */
export const validateClosingDate = (value: unknown) =>
  typeof value !== "string" || value === "" || isClosingYearInRange(value)
    ? undefined
    : {
        message: "resources.deals.validation.closing_date_range",
        args: { min: MIN_CLOSING_YEAR, max: MAX_CLOSING_YEAR },
      };

export function formatISODateString(dateString: string) {
  if (!isISODateString(dateString)) {
    throw new Error("Invalid date format. Expected YYYY-MM-DD.");
  }
  // Some browsers will consider a date in the format YYYY-MM-DD as UTC, which can cause off-by-one-day issues depending on the user's timezone.
  // To avoid this, we can parse the date components manually and create a date object in the local timezone.
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return format(date, "PP");
}
