export type VisibilityWindowKind = "rolling_28d" | "calendar_month";

export type VisibilityPeriod = {
  kind: VisibilityWindowKind;
  startDate: string;
  endDate: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function assertIsoDate(value: string, field: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${field} must use YYYY-MM-DD`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || isoDate(parsed) !== value) {
    throw new Error(`${field} is not a valid calendar date`);
  }
}

export function previousCalendarMonth(now = new Date()): VisibilityPeriod {
  const currentMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const end = new Date(currentMonthStart.getTime() - DAY_MS);
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  return {
    kind: "calendar_month",
    startDate: isoDate(start),
    endDate: isoDate(end),
  };
}

export function rolling28Days(now = new Date()): VisibilityPeriod {
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const start = new Date(end.getTime() - 27 * DAY_MS);
  return {
    kind: "rolling_28d",
    startDate: isoDate(start),
    endDate: isoDate(end),
  };
}

export function resolveVisibilityPeriod(input: {
  kind?: VisibilityWindowKind | null;
  startDate?: string | null;
  endDate?: string | null;
  now?: Date;
}): VisibilityPeriod {
  // Kalendermånad är basen för all kundvänd rapportering (matchar Search
  // Console). Rullande 28-dagars finns kvar i typen för att läsa äldre rader,
  // men ingen ny analys ska defaulta till den.
  const kind = input.kind ?? "calendar_month";
  if (
    (input.startDate && !input.endDate) ||
    (!input.startDate && input.endDate)
  ) {
    throw new Error("start_date and end_date must be provided together");
  }
  if (input.startDate && input.endDate) {
    assertIsoDate(input.startDate, "start_date");
    assertIsoDate(input.endDate, "end_date");
    if (input.startDate > input.endDate) {
      throw new Error("start_date must be on or before end_date");
    }
    return { kind, startDate: input.startDate, endDate: input.endDate };
  }
  return kind === "calendar_month"
    ? previousCalendarMonth(input.now)
    : rolling28Days(input.now);
}
