export const BUSINESS_TIMEZONE = "Europe/Rome";

const BUSINESS_DATE_FORMATTER = new Intl.DateTimeFormat("en", {
  timeZone: BUSINESS_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Current calendar date as YYYY-MM-DD in business timezone (Europe/Rome). */
export const todayISODate = (): string => toISODate(new Date());

/** Date object → YYYY-MM-DD in business timezone (Europe/Rome). */
export const toISODate = (date: Date): string => {
  const parts = BUSINESS_DATE_FORMATTER.formatToParts(date);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${d}`;
};

/**
 * Format a Date as YYYY-MM-DD in an arbitrary timezone.
 * Use `toISODate()` for business dates — this is for cases that need
 * a caller-specified timezone (e.g. unified_crm_answer with configurable tz).
 */
export const formatDateInTimezone = (
  date: Date,
  timeZone: string,
): string | null => {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return y && m && d ? `${y}-${m}-${d}` : null;
};
