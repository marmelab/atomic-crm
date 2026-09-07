// Client + Session Operations cadence correction: a minimal, dependency-
// free RFC5545 VEVENT parser — deliberately narrow (this repo blocks new
// npm/pnpm/yarn installs without a human validation pass first — see
// .claude/rules/dependency-safety.md — and the real shape needed here,
// confirmed by inspecting Leif's actual "Year Planning" calendar before
// writing this, is simple: single, non-recurring, all-day VEVENTs).
//
// Deliberately does NOT expand recurrence (RRULE) — none of the real
// "1:1s" events inspected carry one (each was created individually,
// confirmed via the calendar's own event list), and silently mis-
// expanding a recurrence rule this parser was never built for would be
// exactly the kind of guess this slice's own governing principle
// forbids ("Atomic handles certainty, Leif handles ambiguity"). A VEVENT
// with an RRULE is returned with `hasRecurrenceRule: true` so the caller
// can skip and report it rather than silently mis-ingesting it.
export type ParsedIcsEvent = {
  uid: string;
  summary: string;
  // Bare "YYYY-MM-DD" for an all-day (VALUE=DATE) event; null when this
  // event carries a timed DTSTART instead (VALUE=DATE-TIME, or untyped
  // with a time component) — the caller only ever cares about all-day
  // events for 1:1 windows.
  startDate: string | null;
  endDate: string | null;
  status: string | null;
  hasRecurrenceRule: boolean;
};

// Unfolds RFC5545 line continuations (a line starting with a single
// space or tab is a continuation of the previous line) and normalizes
// line endings — real ICS feeds use CRLF, but never assume the source
// always does.
const unfoldLines = (icsText: string): string[] => {
  const rawLines = icsText.split(/\r\n|\r|\n/);
  const lines: string[] = [];
  for (const line of rawLines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
};

// A content line is "NAME;PARAM=VALUE;PARAM2=VALUE2:VALUE" — this splits
// off the property name (ignoring parameters, e.g. "DTSTART;VALUE=DATE")
// and the raw value, at the FIRST unparenthesized colon.
const splitContentLine = (
  line: string,
): { name: string; params: string; value: string } | null => {
  const colonIndex = line.indexOf(":");
  if (colonIndex === -1) return null;
  const left = line.slice(0, colonIndex);
  const value = line.slice(colonIndex + 1);
  const semicolonIndex = left.indexOf(";");
  const name = semicolonIndex === -1 ? left : left.slice(0, semicolonIndex);
  const params = semicolonIndex === -1 ? "" : left.slice(semicolonIndex + 1);
  return { name: name.toUpperCase(), params, value };
};

// "20260913" (VALUE=DATE) -> "2026-09-13". Returns null for anything not
// exactly 8 digits (a timed DTSTART, e.g. "20260913T180000Z", is
// deliberately NOT reinterpreted as a date — see ParsedIcsEvent's own
// comment).
const toIsoDate = (rawValue: string): string | null => {
  if (!/^\d{8}$/.test(rawValue)) return null;
  return `${rawValue.slice(0, 4)}-${rawValue.slice(4, 6)}-${rawValue.slice(6, 8)}`;
};

export const parseIcsEvents = (icsText: string): ParsedIcsEvent[] => {
  const lines = unfoldLines(icsText);
  const events: ParsedIcsEvent[] = [];
  let current: Record<string, string> | null = null;
  let currentHasRRule = false;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = {};
      currentHasRRule = false;
      continue;
    }
    if (line === "END:VEVENT") {
      if (current) {
        events.push({
          uid: current.UID ?? "",
          summary: current.SUMMARY ?? "",
          startDate: current.DTSTART ? toIsoDate(current.DTSTART) : null,
          endDate: current.DTEND ? toIsoDate(current.DTEND) : null,
          status: current.STATUS ?? null,
          hasRecurrenceRule: currentHasRRule,
        });
      }
      current = null;
      continue;
    }
    if (!current) continue;

    const parsed = splitContentLine(line);
    if (!parsed) continue;
    if (parsed.name === "RRULE") {
      currentHasRRule = true;
      continue;
    }
    // Unescape the handful of RFC5545 escape sequences that appear in
    // free-text properties like SUMMARY (\, \; \n).
    current[parsed.name] = parsed.value
      .replace(/\\n/gi, "\n")
      .replace(/\\,/g, ",")
      .replace(/\\;/g, ";")
      .replace(/\\\\/g, "\\");
  }

  return events.filter((event) => event.uid);
};
