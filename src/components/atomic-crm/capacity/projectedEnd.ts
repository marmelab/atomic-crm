import type { Enrollment } from "../types";

// When a running container is expected to finish.
//
// No Living Example Enrollment in this database carries an end_date. The
// programme is four months long, so the date is derivable — but only from
// facts the CRM actually holds, and only where it holds them.
//
// Evidence in order of authority, and nothing is invented to fill a gap:
//
//   1. `recorded` — the Enrollment's own end_date. Somebody wrote it down.
//      Always wins, even when it disagrees with the arithmetic: a
//      container that was extended or cut short is still the truth.
//   2. `projected` — start_date plus the Offer's length. Arithmetic on two
//      real facts, and labelled as arithmetic wherever it is shown.
//   3. `unknown` — no end_date, and either no start_date or an Offer whose
//      length nobody has recorded. This is a real state with a real
//      answer: we do not know. It is surfaced for Leif rather than filled
//      in, because a manufactured date would flow straight into the
//      openings maths and out onto a page he plans around.
export type EndDateBasis = "recorded" | "projected" | "unknown";

export type ProjectedEnd = {
  date: string | null;
  basis: EndDateBasis;
};

// Month arithmetic that never rolls over into the wrong month. Adding four
// months to 31 October lands on 28/29 February, not 2/3 March — JavaScript
// Date's own overflow would silently produce the latter, and a capacity
// board that quietly moves somebody's finish into the next month is worse
// than one that admits it does not know.
export const addMonths = (isoDate: string, months: number): string => {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  const targetYear = year + Math.floor((month - 1 + months) / 12);
  const targetMonth = ((((month - 1 + months) % 12) + 12) % 12) + 1;
  const lastDayOfTargetMonth = new Date(
    Date.UTC(targetYear, targetMonth, 0),
  ).getUTCDate();
  const targetDay = Math.min(day, lastDayOfTargetMonth);
  return `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(
    targetDay,
  ).padStart(2, "0")}`;
};

export const projectedEndDate = (
  enrollment: Pick<Enrollment, "start_date" | "end_date">,
  // The Offer's length in whole months. Null for an Offer whose length is
  // not recorded as a number — Growing Yourself Up runs to cohort dates,
  // and the legacy 1:1 Offer's own duration reads "Varies (historical)".
  durationMonths: number | null,
): ProjectedEnd => {
  if (enrollment.end_date) {
    return { date: enrollment.end_date, basis: "recorded" };
  }
  if (!enrollment.start_date || durationMonths == null || durationMonths <= 0) {
    return { date: null, basis: "unknown" };
  }
  return {
    date: addMonths(enrollment.start_date, durationMonths),
    basis: "projected",
  };
};
