import type { Cohort } from "../types";

// When a Growing Yourself Up round runs.
//
// A group programme schedules nothing like the Living Example. Everybody
// in a cohort shares one start, one length and one end — the dates belong
// to the ROUND, not to each person — so none of the twelve-session-week
// machinery applies here, and this module deliberately shares no code with
// it beyond the calendar having days in it.
//
// Duration is a NUMBER and a UNIT, not the free text an Offer carries for
// display. "8 weeks" has to be arithmetic if Start + Duration is going to
// produce an End, and prose that somebody might reasonably rewrite as
// "eight weeks" cannot be arithmetic.
export type DurationUnit = "weeks" | "months";

export type CohortDuration = {
  value: number;
  unit: DurationUnit;
};

// Fall 2026: 22 September plus 8 weeks is 10 November. Eight weeks means
// eight weekly sessions, so the final week begins seven weeks after the
// first — the end is the START of the last week, not the day after the
// eighth one. Off by one here is off by a week in front of ten people.
export const endDateFor = (
  startDate: string | null | undefined,
  duration: CohortDuration | null,
): string | null => {
  if (!startDate || !duration || duration.value <= 0) return null;
  const date = new Date(`${startDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;

  if (duration.unit === "weeks") {
    date.setUTCDate(date.getUTCDate() + (duration.value - 1) * 7);
    return date.toISOString().slice(0, 10);
  }

  // Months clamp to the last real day rather than overflowing: 31 January
  // plus one month is 28 February, never 3 March.
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + duration.value, 1),
  );
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return target.toISOString().slice(0, 10);
};

export type CohortSchedule = {
  startDate: string | null;
  endDate: string | null;
  duration: CohortDuration | null;
  // Whether the end is a date Leif typed rather than one the CRM worked
  // out. An explicit end always wins: a round that overran, or a week off
  // in the middle, is a fact about that round and not an error in the
  // arithmetic.
  endIsExplicit: boolean;
};

// What a cohort's dates actually are, given what is recorded.
//
// The rule, in one place so a card, a form and an email cannot each decide
// it differently: a recorded end date is authoritative. Only when there
// isn't one does Start + Duration fill it in.
export const cohortSchedule = (
  cohort: Pick<
    Cohort,
    "program_start_at" | "program_end_at" | "duration_value" | "duration_unit"
  >,
): CohortSchedule => {
  const duration =
    cohort.duration_value != null && cohort.duration_unit != null
      ? { value: cohort.duration_value, unit: cohort.duration_unit }
      : null;
  const startDate = cohort.program_start_at ?? null;

  if (cohort.program_end_at) {
    return {
      startDate,
      endDate: cohort.program_end_at,
      duration,
      endIsExplicit: true,
    };
  }
  return {
    startDate,
    endDate: endDateFor(startDate, duration),
    duration,
    endIsExplicit: false,
  };
};

// "Sep 22 – Nov 10", or as much of it as is known.
export const cohortDateRange = (
  schedule: CohortSchedule,
  locale = "en-US",
): string | null => {
  const day = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  if (schedule.startDate && schedule.endDate) {
    return `${day(schedule.startDate)} – ${day(schedule.endDate)}`;
  }
  if (schedule.startDate) return day(schedule.startDate);
  return null;
};

// "8 weeks" — the human label, derived from the structured value rather
// than stored alongside it, so the two can never disagree.
export const durationLabel = (
  duration: CohortDuration | null,
): string | null => {
  if (!duration) return null;
  const unit =
    duration.value === 1 ? duration.unit.replace(/s$/, "") : duration.unit;
  return `${duration.value} ${unit}`;
};
