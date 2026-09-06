import { format } from "date-fns";

import type { DealStage } from "../types";

export const findDealLabel = (dealStages: DealStage[], dealValue: string) => {
  const dealStage = dealStages.find((stage) => stage.value === dealValue);
  return dealStage?.label;
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

// For full timestamps (timestamptz columns, e.g. Application.submitted_at)
// where formatISODateString's YYYY-MM-DD guard would throw — no local-noon
// reinterpretation issue here since the value already carries a time
// component. Kept distinct from formatISODateString rather than relaxing
// its regex, so a date-only value still fails loudly if it's ever passed
// somewhere that expects a real timestamp.
export function formatTimestampString(timestamp: string) {
  return format(new Date(timestamp), "PP");
}

// Same timestamptz shape as formatTimestampString, plus the time of day
// ("Sep 3, 4:00 PM") — for the few places the time genuinely matters, e.g.
// a Sales Call's own scheduled_at (Unmatched Sales Call Resolution slice).
export function formatTimestampWithTimeString(timestamp: string) {
  return format(new Date(timestamp), "PP · p");
}

// Short "Oct 31" form of a "YYYY-MM-DD" (or "YYYY-MM") date-only string —
// the same UTC/local-safe manual parsing as formatISODateString above (a
// bare `new Date(str).toLocaleDateString()` risks an off-by-one day
// depending on the viewer's timezone), just a terser output format.
// Extracted here after this exact logic was independently duplicated in
// programs/IndividualProgramPage.tsx and dashboard/
// LivingExampleCapacityCard.tsx — Next Up / Coming Up (Dashboard slice) is
// a third caller, past the point where copy-pasting it again was
// reasonable.
export function formatMonthDayString(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year!, month! - 1, day!).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
