// Deterministic "one artwork per day" selection. No app-wide timezone
// convention existed to reuse (checked), so this establishes one scoped to
// Art Oracle: America/Denver, per the product brief.
export const DENVER_TIME_ZONE = "America/Denver";

// Formats a Date as that day's America/Denver calendar date (YYYY-MM-DD),
// regardless of the viewer's own system timezone.
export const getDenverDateString = (date: Date = new Date()): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: DENVER_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

// Deterministically maps a date string to one item in the list: same date
// string always yields the same item, and different date strings usually
// yield different items (a simple string hash mod length — no consecutive-
// day dissimilarity guarantee, which the brief says isn't required yet).
export const selectDailyArtwork = <T>(
  items: readonly T[],
  dateString: string,
): T => {
  if (items.length === 0) {
    throw new Error("selectDailyArtwork: items must not be empty");
  }
  let hash = 0;
  for (let i = 0; i < dateString.length; i++) {
    hash = (hash * 31 + dateString.charCodeAt(i)) >>> 0;
  }
  return items[hash % items.length]!;
};
