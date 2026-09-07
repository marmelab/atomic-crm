import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

const RESOLVE_CADENCE_TASK_TYPE = "resolve_client_session_cadence";

export type DetectionResult = {
  issuesCreated: number;
  tasksCreated: number;
};

// Client + Session Operations cadence correction: the comparison pass
// that turns each Enrollment's own frozen enrollment_expected_sessions
// slots (assigned by assignEnrollmentExpectedSessions.ts — see its own
// header for the Service Period model) + actual sessions (from Acuity)
// into the one thing Leif needs to act on — a
// resolve_client_session_cadence Task on the existing Dashboard Needs
// Attention surface, never a second alert system. Run after every
// calendar sync, after the assignment pass (see this directory's
// index.ts). Reads enrollment_expected_sessions, never the raw shared
// expected_session_windows directly — a slot's own snapshotted dates are
// what matters here, immune to a later edit of the source calendar
// event.
//
// Only considers a slot "due for a decision" once it has fully CLOSED
// (window_end <= today) — one that hasn't happened yet is never flagged;
// Leif may still book it. Idempotent: re-running never creates a second
// client_session_cadence_issues row for the same (Enrollment, slot)
// pair, and never creates a second pending Task for one that already has
// an open issue — same find-or-create shape as
// ensureResolveSalesCallTask.ts's own app-side precedent. Never
// classifies anything itself (known_skip/rescheduled/missed_ghosted are
// exclusively Leif's own decision, made on the resolution page) —
// "Atomic handles certainty, Leif handles ambiguity."
export const detectClientSessionCadenceIssues = async (
  now: Date = new Date(),
): Promise<DetectionResult> => {
  let issuesCreated = 0;
  let tasksCreated = 0;
  const todayStr = now.toISOString().slice(0, 10);

  const { data: offers } = await supabaseAdmin
    .from("offers")
    .select("id, client_session_acuity_appointment_type_id");
  const trackedOfferIds = new Set(
    (offers ?? [])
      .filter(
        (offer) => offer.client_session_acuity_appointment_type_id != null,
      )
      .map((offer) => offer.id),
  );
  if (trackedOfferIds.size === 0) return { issuesCreated, tasksCreated };

  // The Dashboard's own Needs Attention bucket filters Tasks by
  // `sales_id: identity?.id` — a Task created with no sales_id never
  // matches it and would silently never appear. Same resolution as
  // sales-calls/resolveDefaultTaskSalesId.ts's own app-side precedent
  // (this app has exactly one real owner, the administrator `sales`
  // row), a Deno-side duplicate since Edge Functions can't import from
  // src/.
  const { data: administrators } = await supabaseAdmin
    .from("sales")
    .select("id")
    .eq("administrator", true)
    .limit(1);
  const defaultSalesId = administrators?.[0]?.id;

  const { data: enrollments } = await supabaseAdmin
    .from("enrollments")
    .select("id, opportunity_id, start_date, status");
  const activeEnrollments = (enrollments ?? []).filter(
    (enrollment) =>
      enrollment.status === "active" && enrollment.start_date != null,
  );

  for (const enrollment of activeEnrollments) {
    const { data: deal } = await supabaseAdmin
      .from("deals")
      .select("id, offer_id, contact_id")
      .eq("id", enrollment.opportunity_id)
      .maybeSingle();
    if (!deal || !trackedOfferIds.has(deal.offer_id)) continue;

    const { data: allSlots } = await supabaseAdmin
      .from("enrollment_expected_sessions")
      .select("id, window_start, window_end")
      .eq("enrollment_id", enrollment.id);
    // Eligibility (offer, service start, non-deleted) was already
    // decided once, by the assignment pass, when this slot was created —
    // only "has it closed yet" is decided here.
    const closedSlots = (allSlots ?? []).filter(
      (slot) => slot.window_end <= todayStr,
    );
    if (closedSlots.length === 0) continue;

    const { data: sessions } = await supabaseAdmin
      .from("client_sessions")
      .select("id, status, scheduled_at, no_show_at")
      .eq("enrollment_id", enrollment.id);

    for (const slot of closedSlots) {
      const fulfilled = (sessions ?? []).some(
        (session) =>
          session.status !== "cancelled" &&
          !session.no_show_at &&
          session.scheduled_at >= `${slot.window_start}T00:00:00.000Z` &&
          session.scheduled_at < `${slot.window_end}T00:00:00.000Z`,
      );
      if (fulfilled) continue;

      const { data: existingIssues } = await supabaseAdmin
        .from("client_session_cadence_issues")
        .select("id, resolved_at, classification")
        .eq("enrollment_id", enrollment.id)
        .eq("enrollment_expected_session_id", slot.id);
      const existingIssue = existingIssues?.[0];
      const nowIso = new Date().toISOString();

      // A real human classification is NEVER touched by this automated
      // pass — same rule as ensureCadenceIssueOpen.ts's own app-side
      // precedent (this is the defense-in-depth path for a slot that
      // lost fulfillment some way other than a No-show click, e.g. an
      // Acuity cancellation — the app-side synchronous path already
      // handles No-show itself immediately).
      if (
        existingIssue &&
        existingIssue.resolved_at != null &&
        existingIssue.classification != null
      ) {
        continue;
      }

      let issueId: number | undefined;
      if (!existingIssue) {
        const { data: created } = await supabaseAdmin
          .from("client_session_cadence_issues")
          .insert({
            enrollment_id: enrollment.id,
            enrollment_expected_session_id: slot.id,
          })
          .select("id")
          .single();
        issueId = created?.id;
        if (issueId != null) {
          await supabaseAdmin
            .from("client_session_cadence_issue_events")
            .insert({
              cadence_issue_id: issueId,
              kind: "created",
              occurred_at: nowIso,
            });
        }
        issuesCreated++;
      } else if (existingIssue.resolved_at != null) {
        // Resolved via restored fulfillment (classification null) but
        // unfulfilled again — reopen the SAME row, never a duplicate.
        await supabaseAdmin
          .from("client_session_cadence_issues")
          .update({ resolved_at: null })
          .eq("id", existingIssue.id);
        await supabaseAdmin.from("client_session_cadence_issue_events").insert({
          cadence_issue_id: existingIssue.id,
          kind: "reopened",
          occurred_at: nowIso,
        });
        issueId = existingIssue.id;
      } else {
        issueId = existingIssue.id;
      }
      if (issueId == null) continue;

      const { data: existingTasks } = await supabaseAdmin
        .from("tasks")
        .select("id, done_date")
        .eq("cadence_issue_id", issueId);
      const pendingTask = (existingTasks ?? []).find((task) => !task.done_date);
      if (pendingTask) continue;
      const doneTask = (existingTasks ?? []).find((task) => task.done_date);
      if (doneTask) {
        // The issue was just reopened above — reopen its SAME Task too,
        // never a second one for the same issue.
        await supabaseAdmin
          .from("tasks")
          .update({ done_date: null, status: "pending" })
          .eq("id", doneTask.id);
        continue;
      }

      const { data: contact } = await supabaseAdmin
        .from("contacts")
        .select("first_name, last_name")
        .eq("id", deal.contact_id)
        .maybeSingle();
      const contactName =
        `${contact?.first_name ?? ""} ${contact?.last_name ?? ""}`.trim();
      // window_end is exclusive — the last real day in the slot is one
      // day before it.
      const lastDay = new Date(`${slot.window_end}T00:00:00.000Z`);
      lastDay.setUTCDate(lastDay.getUTCDate() - 1);
      const weekLabel = `${slot.window_start}–${lastDay.toISOString().slice(0, 10)}`;

      await supabaseAdmin.from("tasks").insert({
        contact_id: deal.contact_id,
        type: RESOLVE_CADENCE_TASK_TYPE,
        text: `${contactName} · No session booked for week of ${weekLabel}`,
        due_date: new Date().toISOString(),
        status: "pending",
        cadence_issue_id: issueId,
        ...(defaultSalesId != null ? { sales_id: defaultSalesId } : {}),
      });
      tasksCreated++;
    }
  }

  return { issuesCreated, tasksCreated };
};
