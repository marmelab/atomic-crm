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
