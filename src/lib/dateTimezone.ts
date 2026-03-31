export const BUSINESS_TIMEZONE = "Europe/Rome";
const ISO_DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const BUSINESS_DATE_FORMATTER = new Intl.DateTimeFormat("en", {
  timeZone: BUSINESS_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const BUSINESS_OFFSET_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIMEZONE,
  timeZoneName: "shortOffset",
  hour: "2-digit",
  minute: "2-digit",
});

const isoDateToUtcProbe = (isoDate: string): Date => {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
};

const toUtcDayNumber = (isoDate: string): number => {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / (1000 * 60 * 60 * 24);
};

const parseOffsetMinutes = (offsetLabel: string): number => {
  if (offsetLabel === "GMT" || offsetLabel === "UTC") {
    return 0;
  }

  const match = offsetLabel.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) {
    throw new Error(`Unsupported timezone offset label: ${offsetLabel}`);
  }

  const [, sign, hours, minutes = "00"] = match;
  const totalMinutes = Number(hours) * 60 + Number(minutes);
  return sign === "-" ? -totalMinutes : totalMinutes;
};

const getBusinessOffsetMinutesAt = (date: Date): number => {
  const offsetLabel = BUSINESS_OFFSET_FORMATTER.formatToParts(date).find(
    (part) => part.type === "timeZoneName",
  )?.value;

  if (!offsetLabel) {
    throw new Error("Missing timezone offset information for business date");
  }

  return parseOffsetMinutes(offsetLabel);
};

const businessDateStartUtcDate = (isoDate: string): Date => {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utcMidnight = Date.UTC(year, month - 1, day, 0, 0, 0, 0);

  let offsetMinutes = getBusinessOffsetMinutesAt(new Date(utcMidnight));
  let candidateUtc = utcMidnight - offsetMinutes * 60_000;

  const refinedOffsetMinutes = getBusinessOffsetMinutesAt(new Date(candidateUtc));
  if (refinedOffsetMinutes !== offsetMinutes) {
    offsetMinutes = refinedOffsetMinutes;
    candidateUtc = utcMidnight - offsetMinutes * 60_000;
  }

  return new Date(candidateUtc);
};

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

/** Date-like value → YYYY-MM-DD in business timezone (Europe/Rome). */
export const toBusinessISODate = (value: string | Date): string | null => {
  if (value instanceof Date) {
    if (Number.isNaN(value.valueOf())) return null;
    return toISODate(value);
  }

  if (ISO_DATE_ONLY_PATTERN.test(value)) {
    return value;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return null;
  return toISODate(parsed);
};

/** Add N calendar days to an ISO date string. */
export const addDaysToISODate = (isoDate: string, days: number): string => {
  const probe = isoDateToUtcProbe(isoDate);
  probe.setUTCDate(probe.getUTCDate() + days);
  return probe.toISOString().slice(0, 10);
};

/** Date-like value → business year in Europe/Rome. */
export const getBusinessYear = (value: string | Date): number | null => {
  const isoDate = toBusinessISODate(value);
  if (!isoDate) return null;
  return Number(isoDate.slice(0, 4));
};

/** Date-like value → zero-based business month index in Europe/Rome. */
export const getBusinessMonthIndex = (
  value: string | Date,
): number | null => {
  const isoDate = toBusinessISODate(value);
  if (!isoDate) return null;
  return Number(isoDate.slice(5, 7)) - 1;
};

/** Date-like value → YYYY-MM business month key in Europe/Rome. */
export const getBusinessMonthKey = (value: string | Date): string | null => {
  const isoDate = toBusinessISODate(value);
  if (!isoDate) return null;
  return isoDate.slice(0, 7);
};

/** Business date → ISO timestamp at start of Europe/Rome day. */
export const startOfBusinessDayISOString = (
  value: string | Date,
): string | null => {
  const isoDate = toBusinessISODate(value);
  if (!isoDate) return null;
  return businessDateStartUtcDate(isoDate).toISOString();
};

/** Business date → ISO timestamp at end of Europe/Rome day. */
export const endOfBusinessDayISOString = (
  value: string | Date,
): string | null => {
  const isoDate = toBusinessISODate(value);
  if (!isoDate) return null;
  const nextDayStart = businessDateStartUtcDate(addDaysToISODate(isoDate, 1));
  return new Date(nextDayStart.valueOf() - 1).toISOString();
};

/** Difference in days between two business dates (to - from). */
export const diffBusinessDays = (
  from: string | Date,
  to: string | Date,
): number | null => {
  const fromIso = toBusinessISODate(from);
  const toIso = toBusinessISODate(to);
  if (!fromIso || !toIso) return null;
  return toUtcDayNumber(toIso) - toUtcDayNumber(fromIso);
};

/** Format a business date for UI without leaking the browser timezone. */
export const formatBusinessDate = (
  value: string | Date,
  options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  },
  locale = "it-IT",
): string => {
  const isoDate = toBusinessISODate(value);
  if (!isoDate) return "";

  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: "UTC",
  }).format(isoDateToUtcProbe(isoDate));
};
