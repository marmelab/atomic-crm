import { useGetList, type Identifier } from "ra-core";

import type {
  Application,
  Offer,
  ClientSession,
  ContactNote,
  Deal,
  Enrollment,
  SalesCall,
  WaitlistEntry,
  WaitlistInvitation,
} from "../types";

// A DERIVED relationship timeline. There is no history table and none is
// created: every row below is read straight off a canonical record's own
// stored timestamp (applications.submitted_at, sales_calls.
// attendance_recorded_at, waitlist_entries.removed_at, ...). Nothing is
// duplicated into a new store, and no chronology is manufactured — an
// event only appears when the fact that proves it actually carries a date.
//
// Client sessions are deliberately NOT expanded into the timeline: an
// active Living Example client has dozens, and they would bury the
// high-signal relationship events. They are returned as a count instead,
// for a compact summary line.

export type ContactHistoryEvent = {
  id: string;
  at: string;
  kind:
    | "application"
    | "sales_call"
    | "opportunity"
    | "waitlist"
    | "invitation"
    | "enrollment"
    | "note";
  label: string;
  detail?: string | null;
  // Historical/terminal facts render quieter than live ones.
  tone: "active" | "historical";
};

export const useContactHistory = (contactId: Identifier) => {
  const page = { page: 1, perPage: 200 };
  const byIdAsc = { field: "id" as const, order: "ASC" as const };
  const enabled = contactId != null;

  const { data: applications, isPending: applicationsPending } =
    useGetList<Application>(
      "applications",
      { filter: { contact_id: contactId }, pagination: page, sort: byIdAsc },
      { enabled },
    );
  const { data: deals, isPending: dealsPending } = useGetList<Deal>(
    "deals",
    { filter: { contact_id: contactId }, pagination: page, sort: byIdAsc },
    { enabled },
  );
  const { data: salesCalls, isPending: salesCallsPending } =
    useGetList<SalesCall>(
      "sales_calls",
      { filter: { contact_id: contactId }, pagination: page, sort: byIdAsc },
      { enabled },
    );
  const { data: waitlistEntries, isPending: waitlistPending } =
    useGetList<WaitlistEntry>(
      "waitlist_entries",
      { filter: { contact_id: contactId }, pagination: page, sort: byIdAsc },
      { enabled },
    );
  const { data: notes, isPending: notesPending } = useGetList<ContactNote>(
    "contact_notes",
    { filter: { contact_id: contactId }, pagination: page, sort: byIdAsc },
    { enabled },
  );
  const { data: clientSessions, isPending: sessionsPending } =
    useGetList<ClientSession>(
      "client_sessions",
      { filter: { contact_id: contactId }, pagination: page, sort: byIdAsc },
      { enabled },
    );

  // Each invitation is its own record, so a membership invited in August,
  // again in October and again in January contributes THREE events —
  // something waitlist_entries.status could never express.
  const { data: invitations, isPending: invitationsPending } =
    useGetList<WaitlistInvitation>(
      "waitlist_invitations",
      { filter: { contact_id: contactId }, pagination: page, sort: byIdAsc },
      { enabled },
    );

  const { data: offers } = useGetList<Offer>(
    "offers",
    { filter: {}, pagination: { page: 1, perPage: 100 }, sort: byIdAsc },
    { enabled },
  );

  const dealIds = (deals ?? []).map((deal) => deal.id);
  const { data: enrollments, isPending: enrollmentsPending } =
    useGetList<Enrollment>(
      "enrollments",
      {
        filter: { "opportunity_id@in": `(${dealIds.join(",")})` },
        pagination: page,
        sort: byIdAsc,
      },
      { enabled: enabled && dealIds.length > 0 },
    );

  const isPending =
    applicationsPending ||
    dealsPending ||
    salesCallsPending ||
    waitlistPending ||
    notesPending ||
    sessionsPending ||
    invitationsPending ||
    (dealIds.length > 0 && enrollmentsPending);

  if (isPending) {
    return { isPending: true, events: [], sessionCount: 0 };
  }

  // The Offer, not the Deal name. Deal names embed the person ("Marcus
  // Bennett — The Living Example"), which is pure repetition on that
  // person's own page. Resolved from offer_id rather than parsed out of
  // the name string.
  const dealOfferName = (id: Identifier | null | undefined) => {
    const deal = (deals ?? []).find((d) => String(d.id) === String(id));
    if (!deal) return null;
    return (
      (offers ?? []).find((o) => String(o.id) === String(deal.offer_id))
        ?.name ?? null
    );
  };

  const events: ContactHistoryEvent[] = [];
  const push = (
    event: Omit<ContactHistoryEvent, "at"> & { at?: string | null },
  ) => {
    // No timestamp, no event — chronology is never invented.
    if (!event.at) return;
    events.push({ ...event, at: event.at });
  };

  for (const application of applications ?? []) {
    push({
      id: `application-${application.id}`,
      at: application.submitted_at,
      kind: "application",
      label: "Application submitted",
      detail: application.opportunity_id == null ? null : undefined,
      tone: application.status === "pending" ? "active" : "historical",
    });
    if (application.reviewed_at) {
      push({
        id: `application-${application.id}-reviewed`,
        at: application.reviewed_at,
        kind: "application",
        label: `Application reviewed — ${application.status.replace(/_/g, " ")}`,
        tone: "historical",
      });
    }
  }

  for (const deal of deals ?? []) {
    push({
      id: `deal-${deal.id}`,
      at: deal.created_at,
      kind: "opportunity",
      label: "Opportunity created",
      detail: dealOfferName(deal.id),
      tone:
        deal.outcome == null && deal.stage !== "won" ? "active" : "historical",
    });
    if (deal.outcome != null) {
      push({
        id: `deal-${deal.id}-outcome`,
        at: deal.updated_at,
        kind: "opportunity",
        label: `Opportunity closed — ${deal.outcome.replace(/_/g, " ")}`,
        detail: dealOfferName(deal.id),
        tone: "historical",
      });
    }
  }

  for (const call of salesCalls ?? []) {
    push({
      id: `call-${call.id}-booked`,
      at: call.original_scheduled_at,
      kind: "sales_call",
      label: "Sales call booked",
      detail: dealOfferName(call.opportunity_id),
      tone:
        call.attendance == null && call.cancelled_at == null
          ? "active"
          : "historical",
    });
    if (call.attendance) {
      push({
        id: `call-${call.id}-attendance`,
        at: call.attendance_recorded_at,
        kind: "sales_call",
        label:
          call.attendance === "no_show"
            ? "Sales call — No-show"
            : "Sales call attended",
        detail: dealOfferName(call.opportunity_id),
        tone: "historical",
      });
    }
    if (call.cancelled_at) {
      push({
        id: `call-${call.id}-cancelled`,
        at: call.cancelled_at,
        kind: "sales_call",
        label: "Sales call cancelled",
        tone: "historical",
      });
    }
  }

  for (const entry of waitlistEntries ?? []) {
    push({
      id: `waitlist-${entry.id}-joined`,
      at: entry.joined_at,
      kind: "waitlist",
      label: "Joined waitlist",
      tone:
        entry.status === "waiting" || entry.status === "invited"
          ? "active"
          : "historical",
    });
    // Invitations are canonical records now, so the timeline derives each
    // one individually below. entry.invited_at is only a fallback for a
    // membership that predates that model (an imported historical row, or
    // one invited before this slice) — otherwise the same invitation would
    // appear twice.
    const hasInvitationRecords = (invitations ?? []).some(
      (invitation) => String(invitation.waitlist_entry_id) === String(entry.id),
    );
    if (entry.invited_at && !hasInvitationRecords) {
      push({
        id: `waitlist-${entry.id}-invited`,
        at: entry.invited_at,
        kind: "waitlist",
        label: "Invited from waitlist",
        tone: "historical",
      });
    }
    if (entry.converted_at) {
      push({
        id: `waitlist-${entry.id}-converted`,
        at: entry.converted_at,
        kind: "waitlist",
        label: "Waitlist converted to an Opportunity",
        tone: "historical",
      });
    }
    if (entry.removed_at) {
      push({
        id: `waitlist-${entry.id}-removed`,
        at: entry.removed_at,
        kind: "waitlist",
        label: "Removed from waitlist",
        tone: "historical",
      });
    }
  }

  for (const enrollment of enrollments ?? []) {
    push({
      id: `enrollment-${enrollment.id}`,
      at: enrollment.start_date ?? enrollment.created_at,
      kind: "enrollment",
      label: "Programme started",
      detail: dealOfferName(enrollment.opportunity_id),
      tone: enrollment.status === "completed" ? "historical" : "active",
    });
    if (enrollment.status === "completed" && enrollment.end_date) {
      push({
        id: `enrollment-${enrollment.id}-completed`,
        at: enrollment.end_date,
        kind: "enrollment",
        label: "Programme completed",
        detail: dealOfferName(enrollment.opportunity_id),
        tone: "historical",
      });
    }
  }

  // One event per invitation, so a repeat invite reads as a repeat rather
  // than overwriting the previous one. Only genuinely SENT invitations are
  // shown: a prepared-but-undelivered batch is not something that happened
  // to this person yet.
  for (const invitation of invitations ?? []) {
    const entry = (waitlistEntries ?? []).find(
      (candidate) =>
        String(candidate.id) === String(invitation.waitlist_entry_id),
    );
    const offer = (offers ?? []).find(
      (candidate) => String(candidate.id) === String(entry?.offer_id),
    );
    if (invitation.status === "sent") {
      push({
        id: `invitation-${invitation.id}`,
        at: invitation.sent_at,
        kind: "invitation",
        label: offer
          ? `Invited from the ${offer.name} waitlist to book a sales call`
          : "Invited from waitlist to book a sales call",
        tone: invitation.booked_at ? "historical" : "active",
      });
    }
    if (invitation.booked_at) {
      push({
        id: `invitation-${invitation.id}-booked`,
        at: invitation.booked_at,
        kind: "invitation",
        label: "Booked a sales call after the invitation",
        tone: "historical",
      });
    }
  }

  for (const note of notes ?? []) {
    push({
      id: `note-${note.id}`,
      at: note.date,
      kind: "note",
      label: "Note",
      detail: note.text,
      tone: "historical",
    });
  }

  events.sort((a, b) => b.at.localeCompare(a.at));

  return {
    isPending: false,
    events,
    sessionCount: (clientSessions ?? []).length,
  };
};
