import { formatMonthDayString } from "../deals/dealUtils";

// Shared "Sep 5–Sep 6" formatting for an expected window/slot —
// window_end is EXCLUSIVE (Google Calendar's own all-day semantics), so
// the last day actually inside it is one day before it. Used everywhere
// a date range is shown to Leif (ClientShow, the resolution page, the
// Task text a No-show/detection pass creates) so the exact same label
// appears in every one of those places — works equally for a raw
// ExpectedSessionWindow or an Enrollment's own frozen
// EnrollmentExpectedSession slot, since both share this same shape.
export const formatCadenceWeekLabel = (
  windowStart: string,
  windowEnd: string,
): string => {
  const lastDay = new Date(windowEnd);
  lastDay.setDate(lastDay.getDate() - 1);
  return `${formatMonthDayString(windowStart)}–${formatMonthDayString(
    lastDay.toISOString().slice(0, 10),
  )}`;
};

export const formatWindowWeekLabel = (window: {
  window_start: string;
  window_end: string;
}): string => formatCadenceWeekLabel(window.window_start, window.window_end);
