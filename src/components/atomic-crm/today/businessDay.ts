/**
 * "Today" is the day in the time zone of the business (TZ section 9), not in
 * the time zone of the browser: a Kyiv business checked from Warsaw at
 * 23:30 local time is already on the next day.
 */

interface DateParts {
  year: number;
  month: number;
  day: number;
}

const datePartsIn = (date: Date, timeZone: string): DateParts => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
};

/** Offset of a time zone at a moment, in minutes east of UTC (Kyiv: 120 or 180). */
const offsetMinutes = (date: Date, timeZone: string): number => {
  const name =
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "longOffset",
    })
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "-" ? -minutes : minutes;
};

/** The moment a calendar day starts in a time zone. */
const startOfDay = (
  { year, month, day }: DateParts,
  timeZone: string,
): Date => {
  const utcMidnight = Date.UTC(year, month - 1, day);
  // The offset at local midnight; recomputed once in case midnight sits on
  // the other side of a daylight saving change than the UTC guess.
  let offset = offsetMinutes(new Date(utcMidnight), timeZone);
  offset = offsetMinutes(new Date(utcMidnight - offset * 60_000), timeZone);
  return new Date(utcMidnight - offset * 60_000);
};

export interface BusinessDay {
  /** First moment of today in the business time zone */
  start: Date;
  /** First moment of tomorrow in the business time zone */
  end: Date;
}

export const getBusinessDay = (
  timeZone: string,
  now: Date = new Date(),
): BusinessDay => {
  const today = datePartsIn(now, timeZone);
  const start = startOfDay(today, timeZone);
  const tomorrow = datePartsIn(
    new Date(start.getTime() + 36 * 3_600_000),
    timeZone,
  );
  return { start, end: startOfDay(tomorrow, timeZone) };
};

/** "субота, 14 листопада" in the business time zone and the interface language. */
export const formatBusinessDate = (
  date: Date,
  timeZone: string,
  locale: string,
): { weekday: string; day: string } => ({
  weekday: new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "long",
  }).format(date),
  day: new Intl.DateTimeFormat(locale, {
    timeZone,
    day: "numeric",
    month: "long",
  }).format(date),
});
