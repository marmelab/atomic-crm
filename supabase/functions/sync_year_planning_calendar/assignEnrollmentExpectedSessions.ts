import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

export type AssignmentResult = {
  assignmentsCreated: number;
};

// Client + Session Operations Service Period model: the append-only pass
// that turns the shared, calendar-synced expected_session_windows into
// each active Living Example Enrollment's own frozen, sequential 12-slot
// cadence (Service Period = ceil(ordinal / 3), 3 slots per period, 4
// periods total — the REAL business model, replacing the earlier
// 30/31-day calendar-month approximation). Run after every calendar sync
// (see this directory's index.ts), before detectClientSessionCadenceIssues
// — which reads these frozen slots, never the raw shared windows, for
// matching/period display.
//
// NEVER reassigns or renumbers an existing slot: a later edit (or even a
// deletion) of the source calendar event can never shift which
// ordinal/Service Period an already-assigned slot belongs to, or change
// its own displayed dates (snapshotted here at assignment time — same
// "historical integrity from a snapshot" convention as
// deals.offer_name_snapshot). Only NEW eligible windows not yet assigned
// to THIS Enrollment ever receive the next available ordinal(s), up to
// 12 total. A calendar gap (holiday, travel) simply means fewer windows
// exist at that point — it never creates a phantom slot and never
// "spends" one of the 12 early. Idempotent: re-running never reassigns
// an existing ordinal and never assigns the same source window twice to
// the same Enrollment (the database's own unique indexes are the actual
// backstop; this pass never even attempts either).
export const assignEnrollmentExpectedSessions =
  async (): Promise<AssignmentResult> => {
    let assignmentsCreated = 0;

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
    if (trackedOfferIds.size === 0) return { assignmentsCreated };

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
        .select("id, offer_id")
        .eq("id", enrollment.opportunity_id)
        .maybeSingle();
      if (!deal || !trackedOfferIds.has(deal.offer_id)) continue;

      const { data: existingAssignments } = await supabaseAdmin
        .from("enrollment_expected_sessions")
        .select("ordinal, source_window_id")
        .eq("enrollment_id", enrollment.id);
      const assigned = existingAssignments ?? [];
      // The full 12-slot cadence is already assigned — nothing more to do,
      // ever, for this Enrollment (a 13th real window is simply out of
      // scope for this offer's contractual cadence).
      if (assigned.length >= 12) continue;

      const assignedWindowIds = new Set(
        assigned.map((a) => a.source_window_id),
      );
      const highestOrdinal = assigned.reduce(
        (max, a) => Math.max(max, a.ordinal),
        0,
      );

      const { data: allWindows } = await supabaseAdmin
        .from("expected_session_windows")
        .select("id, window_start, window_end, raw_title, deleted_at")
        .eq("offer_id", deal.offer_id);

      const eligible = (allWindows ?? [])
        .filter((window) => window.deleted_at == null)
        .filter((window) => window.window_start >= enrollment.start_date)
        .filter((window) => !assignedWindowIds.has(window.id))
        .sort((a, b) => {
          if (a.window_start !== b.window_start) {
            return a.window_start < b.window_start ? -1 : 1;
          }
          if (a.window_end !== b.window_end) {
            return a.window_end < b.window_end ? -1 : 1;
          }
          return a.id - b.id;
        });

      const slotsRemaining = 12 - assigned.length;
      const toAssign = eligible.slice(0, slotsRemaining);

      for (let i = 0; i < toAssign.length; i++) {
        const window = toAssign[i];
        await supabaseAdmin.from("enrollment_expected_sessions").insert({
          enrollment_id: enrollment.id,
          source_window_id: window.id,
          ordinal: highestOrdinal + i + 1,
          window_start: window.window_start,
          window_end: window.window_end,
          raw_title: window.raw_title,
        });
        assignmentsCreated++;
      }
    }

    return { assignmentsCreated };
  };
