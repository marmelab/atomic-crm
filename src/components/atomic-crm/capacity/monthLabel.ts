// "2026-11" → "November 2026".
//
// Openings are reported by month on purpose. A projected end date is
// arithmetic on a start date, not a commitment anybody made, and printing
// "Next opening: Nov 19" invites Leif to plan a day that nothing in the
// CRM actually promises. The month is the honest unit for a projection.
export const monthLabel = (yearMonth: string, locale = "en-US"): string => {
  const [year, month] = yearMonth.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) return yearMonth;
  return new Date(year, month - 1, 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
};

// "2026-10-05" → "week of Oct 5".
//
// A week IS an honest unit, where a projected day is not. Year Tracking is
// kept in weeks, a Start Date names the week of Session #1, and "the week
// of 5 October" is a thing Leif can actually hold somebody to. The month
// above stays the unit for a projected FINISH, which is arithmetic rather
// than a commitment.
export const weekLabel = (isoDate: string, locale = "en-US"): string =>
  new Date(`${isoDate}T00:00:00Z`).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
