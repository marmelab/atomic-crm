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
