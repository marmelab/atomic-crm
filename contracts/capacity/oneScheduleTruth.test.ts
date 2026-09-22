import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

// "Sync Calendar must leave these in agreement."
//
// The failure this exists to prevent already happened once in slow motion.
// The capacity board was moved onto the owner-stated Start Dates and the
// Year Tracking calendar, while enrollment_expected_sessions stayed
// append-only and kept the session plan numbered from the imported dates.
// One Enrollment, two timelines, and nothing in the repository objected.
//
// So: one rule, one rebuild, and a sync that runs it.

const read = (path: string) => readFileSync(path, "utf8");

// Comments in these files deliberately NAME the tables a rebuild must not
// touch, because saying so is the point. The prohibition is about
// statements, so strip the prose before looking for them.
const statementsOf = (path: string) =>
  read(path)
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");

const MIGRATION =
  "supabase/migrations/20260921150000_a_session_schedule_is_derived.sql";
const SYNC_INDEX = "supabase/functions/sync_year_planning_calendar/index.ts";
const REBUILD_PASS =
  "supabase/functions/sync_year_planning_calendar/rebuildEnrollmentExpectedSessions.ts";

describe("one schedule truth", () => {
  test("the twelve-week rule is written once in the database", () => {
    const sql = read(MIGRATION);
    expect(sql).toMatch(/v_required := 12 \+ coalesce\(v_extensions, 0\)/);
    // And the eligibility rule is the containing-or-next week, stated in
    // the one place that computes it.
    expect(sql).toMatch(/w\.window_end > v_start/);
  });

  test("a calendar sync rebuilds the schedule rather than appending to it", () => {
    const index = read(SYNC_INDEX);
    expect(index).toMatch(/rebuildEnrollmentExpectedSessions/);
    // The pass this replaced is gone, not merely unused.
    expect(index).not.toMatch(/assignEnrollmentExpectedSessions/);
    expect(() =>
      read(
        "supabase/functions/sync_year_planning_calendar/assignEnrollmentExpectedSessions.ts",
      ),
    ).toThrow();
  });

  test("the sync's rebuild pass reimplements nothing — it calls the one function", () => {
    const pass = read(REBUILD_PASS);
    expect(pass).toMatch(/rebuild_all_expected_sessions/);
    // No second copy of the rule in TypeScript.
    expect(pass).not.toMatch(/\b12\b/);
    expect(pass).not.toMatch(/window_end/);
  });

  test("a corrected Start Date rebuilds in the same transaction", () => {
    // Not on the next sync, not on a nightly job. There is no window in
    // which the Start Date and the schedule derived from it can disagree.
    const sql = read(MIGRATION);
    expect(sql).toMatch(/after update of start_date on public\.enrollments/);
    expect(sql).toMatch(/rebuild_enrollment_expected_sessions\(new\.id\)/);
  });

  test("a rebuild never deletes a week that carries an owner decision", () => {
    const sql = read(MIGRATION);
    // Retire first, then delete ONLY what has no cadence issue attached.
    expect(sql).toMatch(/set retired_at = now\(\)/);
    expect(sql).toMatch(
      /delete from enrollment_expected_sessions[\s\S]*?not exists \(\s*select 1 from client_session_cadence_issues/,
    );
  });

  test("a rebuild never touches an actual session or an attendance fact", () => {
    const sql = statementsOf(MIGRATION);
    for (const forbidden of [
      /update client_sessions/i,
      /delete from client_sessions/i,
      /update client_session_cadence_issues/i,
      /delete from client_session_cadence_issues/i,
      /client_session_cadence_issue_events/i,
      /no_show_at/i,
    ]) {
      expect(sql).not.toMatch(forbidden);
    }
  });

  test("only a cross-week reschedule lengthens a container", () => {
    const sql = read(MIGRATION);
    expect(sql).toMatch(/i\.classification = 'rescheduled'/);
    // Never Acuity's own counter, which includes same-week changes.
    expect(sql).not.toMatch(/reschedule_count/);
  });

  test("the browser never holds the cron secret", () => {
    // Two callers, two proofs. A JWT for Leif, the shared secret for
    // pg_net, and neither can stand in for the other.
    const index = read(SYNC_INDEX);
    expect(index).toMatch(/supabaseAdmin\.auth\.getUser/);
    expect(index).toMatch(/CRON_INVOKE_SECRET/);

    const client = read(
      "src/components/atomic-crm/capacity/syncYearTracking.ts",
    );
    expect(client).not.toMatch(/CRON_INVOKE_SECRET/i);
    expect(client).not.toMatch(/x-cron-secret/i);
  });
});

describe("Growing Yourself Up is not the Living Example", () => {
  // Two programmes, two scheduling models, and they must not borrow each
  // other's rules. A group round runs to published cohort dates that
  // everybody shares; the Living Example runs twelve sessions across
  // Leif's available `1:1s` weeks. A GYU round with a summer in the middle
  // of it does not get longer, and an LE container with a bank holiday in
  // it does.
  const COHORT_DATES = "src/components/atomic-crm/cohorts/cohortDates.ts";

  test("cohort dates never consult the Year Tracking calendar", () => {
    const source = read(COHORT_DATES);
    expect(source).not.toMatch(/expected_session_windows/);
    expect(source).not.toMatch(/sessionWeeks/);
    expect(source).not.toMatch(/eligibleWeeksFrom|computeExpectedEnd/);
    expect(source).not.toMatch(/SESSIONS_PER_CONTAINER|\b12\b/);
  });

  test("the twelve-week engine never reads a cohort's duration", () => {
    const source = read("src/components/atomic-crm/capacity/sessionWeeks.ts");
    expect(source).not.toMatch(/duration_value|duration_unit|cohort/i);
  });

  test("a cohort's length is structured, never parsed from the Offer's prose", () => {
    const source = read(COHORT_DATES);
    expect(source).toMatch(/duration_value/);
    // The free-text field is for display and is never read here.
    expect(source).not.toMatch(/\.duration\b/);
  });
});

describe("program rules belong to the program TYPE, never to a name", () => {
  // The Living Example is the current 1:1 program and Growing Yourself Up
  // the current group one, but neither name may appear in a branch. A
  // second 1:1 program must inherit the individual architecture on the day
  // it is created, without anybody editing a condition.
  const BEHAVIOURAL = [
    "src/components/atomic-crm/capacity/sessionWeeks.ts",
    "src/components/atomic-crm/capacity/occupancyLedger.ts",
    "src/components/atomic-crm/capacity/individualCapacity.ts",
    "src/components/atomic-crm/capacity/useSessionWeeks.ts",
    "src/components/atomic-crm/cohorts/cohortDates.ts",
    "src/components/atomic-crm/dashboard/livingExampleCapacity.ts",
    "src/components/atomic-crm/dashboard/useLivingExampleCapacityData.ts",
    "src/components/atomic-crm/dashboard/comingUpProjection.ts",
    "src/components/atomic-crm/dashboard/useComingUpItems.ts",
    "src/components/atomic-crm/programs/useIndividualProgramData.ts",
    "supabase/migrations/20260921150000_a_session_schedule_is_derived.sql",
    "supabase/migrations/20260921170000_a_cohort_has_a_structured_duration.sql",
  ];

  test.each(BEHAVIOURAL)("%s branches on no program name", (path) => {
    // Comments may name the real programs — that is how the reasoning gets
    // recorded. Code may not.
    const code = path.endsWith(".sql")
      ? statementsOf(path)
      : read(path)
          .split("\n")
          .filter((line) => {
            const t = line.trimStart();
            return (
              !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*")
            );
          })
          .join("\n");
    expect(code).not.toMatch(/Living Example/i);
    expect(code).not.toMatch(/Growing Yourself/i);
    // Nor an offer id standing in for one.
    expect(code).not.toMatch(/offer_id\s*=\s*\d/);
    expect(code).not.toMatch(/offerId\s*===\s*\d/);
  });

  test("the individual schedule rebuild selects on type", () => {
    expect(
      statementsOf(
        "supabase/migrations/20260921150000_a_session_schedule_is_derived.sql",
      ),
    ).toMatch(/o\.type = 'individual'/);
  });

  test("the cohort duration backfill selects on type", () => {
    expect(
      statementsOf(
        "supabase/migrations/20260921170000_a_cohort_has_a_structured_duration.sql",
      ),
    ).toMatch(/o\.type = 'group'/);
  });
});

describe("the Group Program UX branches on type, never on a name", () => {
  const GROUP_UX = [
    "src/components/atomic-crm/cohorts/CohortScheduleInputs.tsx",
    "src/components/atomic-crm/cohorts/cohortDates.ts",
    "src/components/atomic-crm/programs/ProgramCardMenu.tsx",
    "src/components/atomic-crm/programs/programDeleteSafety.ts",
    "src/components/atomic-crm/dashboard/CohortCapacityCard.tsx",
    "src/components/atomic-crm/programs/IndividualProgramCard.tsx",
    "src/components/atomic-crm/offers/OfferEdit.tsx",
  ];

  test.each(GROUP_UX)("%s names no program and no offer id", (path) => {
    const code = read(path)
      .split("\n")
      .filter((line) => {
        const t = line.trimStart();
        return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
      })
      .join("\n");
    expect(code).not.toMatch(/Living Example/i);
    expect(code).not.toMatch(/Growing Yourself/i);
    expect(code).not.toMatch(/offer_id\s*[=:]\s*\d/);
    expect(code).not.toMatch(/cohort_id\s*[=:]\s*\d/);
  });

  test("a 1:1 program card never renders cohort schedule fields", () => {
    // The type distinction, enforced rather than described: a 1:1 program
    // has no shared start, duration or end, because each client has their
    // own.
    const card = read(
      "src/components/atomic-crm/programs/IndividualProgramCard.tsx",
    );
    expect(card).not.toMatch(
      /CohortScheduleInputs|cohortDateRange|duration_value/,
    );

    const form = read("src/components/atomic-crm/offers/OfferInputs.tsx");
    expect(form).not.toMatch(/program_start_at|program_end_at|duration_value/);
  });

  test("the group schedule inputs live only on the cohort form", () => {
    const cohortForm = read(
      "src/components/atomic-crm/cohorts/CohortInputs.tsx",
    );
    expect(cohortForm).toMatch(/CohortScheduleInputs/);
  });

  test("delete safety counts the waiting list, which the database would cascade away", () => {
    // waitlist_entries.cohort_id is ON DELETE CASCADE, so Postgres would
    // let a Cohort take its waiting list with it. Nothing else protects
    // those fifty-one people.
    const safety = read(
      "src/components/atomic-crm/programs/programDeleteSafety.ts",
    );
    expect(safety).toMatch(/waitlist_entries/);
    expect(safety).toMatch(/cohort_id: cohortId/);
    // And an unknown count must never read as "safe to delete".
    expect(safety).toMatch(/return 1;/);
  });
});
