import { format, isValid, isSameDay } from "date-fns";
import { it } from "date-fns/locale";
import { formatBusinessDate, toBusinessISODate } from "@/lib/dateTimezone";

/**
 * Format a date range for display in lists and cards.
 * Handles: single date, range, same-day range, with/without time.
 */
export const formatDateRange = (
  start?: string | null,
  end?: string | null,
  allDay = true,
): string => {
  if (!start) return "";

  if (allDay) {
    const startIso = toBusinessISODate(start);
    if (!startIso) return "";

    const startLabel =
      formatBusinessDate(startIso, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }) ?? "";

    if (!end) return startLabel;

    const endIso = toBusinessISODate(end);
    if (!endIso) return startLabel;
    if (startIso === endIso) return startLabel;

    const endLabel =
      formatBusinessDate(endIso, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }) ?? "";

    return `${startLabel} – ${endLabel}`;
  }

  const s = new Date(start);
  if (!isValid(s)) return "";

  const dateFmt = "dd/MM/yyyy";
  const dateTimeFmt = "dd/MM/yyyy HH:mm";
  const fmt = dateTimeFmt;

  if (!end) return format(s, fmt);

  const e = new Date(end);
  if (!isValid(e)) return format(s, fmt);

  if (allDay && isSameDay(s, e)) return format(s, dateFmt);
  if (!allDay && isSameDay(s, e)) {
    return `${format(s, dateFmt)} ${format(s, "HH:mm")}–${format(e, "HH:mm")}`;
  }

  return `${format(s, fmt)} – ${format(e, fmt)}`;
};

/**
 * Format a date range for PDF (long Italian format).
 * E.g. "15 marzo 2026", "15 marzo 2026 10:30",
 *      "15 marzo 2026 – 17 marzo 2026"
 */
export const formatDateLong = (
  start?: string | null,
  end?: string | null,
  allDay = true,
): string => {
  if (!start) return "—";

  if (allDay) {
    const startIso = toBusinessISODate(start);
    if (!startIso) return "—";

    const startLabel =
      formatBusinessDate(
        startIso,
        {
          day: "2-digit",
          month: "long",
          year: "numeric",
        },
        "it-IT",
      ) ?? "—";

    if (!end) return startLabel;

    const endIso = toBusinessISODate(end);
    if (!endIso) return startLabel;
    if (startIso === endIso) return startLabel;

    const endLabel =
      formatBusinessDate(
        endIso,
        {
          day: "2-digit",
          month: "long",
          year: "numeric",
        },
        "it-IT",
      ) ?? startLabel;

    return `${startLabel} – ${endLabel}`;
  }

  const s = new Date(start);
  if (!isValid(s)) return "—";

  const dateFmt = "dd MMMM yyyy";
  const dateTimeFmt = "dd MMMM yyyy HH:mm";
  const opts = { locale: it };
  const fmt = dateTimeFmt;

  if (!end) return format(s, fmt, opts);

  const e = new Date(end);
  if (!isValid(e)) return format(s, fmt, opts);

  if (allDay && isSameDay(s, e)) return format(s, dateFmt, opts);
  if (!allDay && isSameDay(s, e)) {
    return `${format(s, dateFmt, opts)} ${format(s, "HH:mm")}–${format(e, "HH:mm")}`;
  }

  return `${format(s, fmt, opts)} – ${format(e, fmt, opts)}`;
};
