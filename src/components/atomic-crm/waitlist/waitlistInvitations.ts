import type { DataProvider, Identifier } from "ra-core";

import type {
  WaitlistEntry,
  WaitlistInvitation,
  WaitlistInvitationBatch,
  WaitlistInvitationDeliveryMethod,
} from "../types";

// The ONE canonical way a waitlist invitation comes into existence.
//
// Leif's real workflow: the sales-call calendar fills, he stops inviting;
// when capacity reopens he invites a large batch (30-40 people) off a
// waitlist to go book. That is a durable business event, and Gmail will
// later be a DELIVERY MECHANISM attached to these records — not the place
// the event lives.
//
// Both entry points use this module, so bulk and individual invites can
// never diverge into "bulk creates history, individual silently changes a
// status".

// Which memberships may be included in a new batch. A membership that has
// already converted or been removed is finished; a currently waiting OR
// previously invited one may legitimately be invited again (the August /
// October / January re-invite case is the whole reason invitations are
// their own records).
export const INVITABLE_WAITLIST_STATUSES: ReadonlySet<WaitlistEntry["status"]> =
  new Set(["waiting", "invited"]);

export const isInvitable = (entry: Pick<WaitlistEntry, "status">) =>
  INVITABLE_WAITLIST_STATUSES.has(entry.status);

export type PrepareInvitationBatchInput = {
  offerId: Identifier;
  cohortId?: Identifier | null;
  label?: string | null;
  entryIds: Identifier[];
};

export type PrepareInvitationBatchResult = {
  batch: WaitlistInvitationBatch;
  invitations: WaitlistInvitation[];
  // Entries asked for but not invitable (already converted/removed, or
  // gone). Reported rather than silently dropped.
  skippedEntryIds: Identifier[];
};

/**
 * Creates one batch plus one invitation per selected membership.
 *
 * Deliberately does NOT send anything and does NOT touch
 * waitlist_entries.status: nothing has been delivered yet, and marking
 * somebody Invited because a checkbox was ticked would be a lie. The
 * membership transitions only when a real send succeeds — see
 * recordInvitationSent below.
 */
export const prepareInvitationBatch = async (
  dataProvider: DataProvider,
  {
    offerId,
    cohortId = null,
    label = null,
    entryIds,
  }: PrepareInvitationBatchInput,
): Promise<PrepareInvitationBatchResult> => {
  const entries = await Promise.all(
    entryIds.map((id) =>
      dataProvider
        .getOne<WaitlistEntry>("waitlist_entries", { id })
        .then((res) => res.data)
        .catch(() => null),
    ),
  );

  const invitable: WaitlistEntry[] = [];
  const skippedEntryIds: Identifier[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (!entry || !isInvitable(entry)) {
      continue;
    }
    // One invitation per membership per batch — a duplicated selection is
    // collapsed rather than creating two rows the unique index would
    // reject anyway.
    if (seen.has(String(entry.id))) continue;
    seen.add(String(entry.id));
    invitable.push(entry);
  }
  for (const [index, entry] of entries.entries()) {
    if (!entry || !isInvitable(entry)) skippedEntryIds.push(entryIds[index]!);
  }

  const { data: batch } = await dataProvider.create<WaitlistInvitationBatch>(
    "waitlist_invitation_batches",
    {
      data: {
        offer_id: offerId,
        cohort_id: cohortId,
        label,
        status: "prepared",
      } as Partial<WaitlistInvitationBatch>,
    },
  );

  const invitations: WaitlistInvitation[] = [];
  for (const entry of invitable) {
    const { data: invitation } = await dataProvider.create<WaitlistInvitation>(
      "waitlist_invitations",
      {
        data: {
          batch_id: batch.id,
          waitlist_entry_id: entry.id,
          contact_id: entry.contact_id,
          status: "prepared",
          prepared_at: new Date().toISOString(),
        } as Partial<WaitlistInvitation>,
      },
    );
    invitations.push(invitation);
  }

  return { batch, invitations, skippedEntryIds };
};

/**
 * Records that ONE invitation was genuinely delivered, and only then moves
 * that person's membership to Invited.
 *
 * This is the hook the Gmail integration will call once per successful
 * send. It is per-person on purpose: one person's success must never mark
 * anybody else invited, and one person's failure must never roll back the
 * people who did receive theirs.
 */
export const recordInvitationSent = async (
  dataProvider: DataProvider,
  invitationId: Identifier,
  deliveryMethod: WaitlistInvitationDeliveryMethod,
): Promise<{ applied: boolean }> => {
  const { data: invitation } = await dataProvider.getOne<WaitlistInvitation>(
    "waitlist_invitations",
    { id: invitationId },
  );
  if (invitation.status === "sent") return { applied: false };

  const now = new Date().toISOString();
  await dataProvider.update<WaitlistInvitation>("waitlist_invitations", {
    id: invitation.id,
    data: {
      status: "sent",
      sent_at: now,
      delivery_method: deliveryMethod,
      failed_at: null,
      failure_reason: null,
    },
    previousData: invitation,
  });

  // The membership follows the delivery, never the selection. Only a
  // still-waiting entry moves: a converted or removed one is finished, and
  // an already-invited one is simply invited again (its status is already
  // correct, and the new invitation row is what records the repeat).
  const { data: entry } = await dataProvider.getOne<WaitlistEntry>(
    "waitlist_entries",
    { id: invitation.waitlist_entry_id },
  );
  if (entry.status === "waiting") {
    await dataProvider.update<WaitlistEntry>("waitlist_entries", {
      id: entry.id,
      data: { status: "invited", invited_at: now },
      previousData: entry,
    });
  }

  return { applied: true };
};

/**
 * Records that ONE invitation failed to deliver. It stays retryable and
 * nobody's membership changes.
 */
export const recordInvitationFailed = async (
  dataProvider: DataProvider,
  invitationId: Identifier,
  failureReason: string,
): Promise<{ applied: boolean }> => {
  const { data: invitation } = await dataProvider.getOne<WaitlistInvitation>(
    "waitlist_invitations",
    { id: invitationId },
  );
  if (invitation.status === "sent") return { applied: false };

  await dataProvider.update<WaitlistInvitation>("waitlist_invitations", {
    id: invitation.id,
    data: {
      status: "failed",
      failed_at: new Date().toISOString(),
      failure_reason: failureReason,
    },
    previousData: invitation,
  });
  return { applied: true };
};

/**
 * Records an invitation Leif sent himself, outside the CRM — the truthful
 * meaning of the existing single-person "Mark Invited" action. It creates
 * the same canonical batch + invitation records a Gmail send will, with
 * delivery_method 'manual', so individual invites appear in history
 * identically to batched ones.
 */
export const recordManualInvitation = async (
  dataProvider: DataProvider,
  entryId: Identifier,
): Promise<{ applied: boolean; reason?: "not-invitable" }> => {
  const { data: entry } = await dataProvider.getOne<WaitlistEntry>(
    "waitlist_entries",
    { id: entryId },
  );
  if (!isInvitable(entry)) return { applied: false, reason: "not-invitable" };

  const { invitations } = await prepareInvitationBatch(dataProvider, {
    offerId: entry.offer_id,
    cohortId: entry.cohort_id ?? null,
    entryIds: [entry.id],
  });
  const invitation = invitations[0];
  if (!invitation) return { applied: false, reason: "not-invitable" };

  await recordInvitationSent(dataProvider, invitation.id, "manual");
  return { applied: true };
};

/**
 * Attributes a booking to the most recent still-open invitation for this
 * membership — the fact that makes "has this person booked since we asked?"
 * (and therefore "is a no-booking follow-up still eligible?") answerable.
 *
 * Not wired to anything yet: the Gmail slice owns the follow-up sequence,
 * and the booking signal itself already exists (an Acuity booking creates
 * or attaches an Opportunity, which is what flips the membership to
 * converted via waitlistSync.ts). This is the seam that slice attaches to.
 */
export const attributeBookingToInvitation = async (
  dataProvider: DataProvider,
  {
    waitlistEntryId,
    salesCallId,
    bookedAt,
  }: {
    waitlistEntryId: Identifier;
    salesCallId: Identifier;
    bookedAt: string;
  },
): Promise<{ applied: boolean }> => {
  const { data: invitations } = await dataProvider.getList<WaitlistInvitation>(
    "waitlist_invitations",
    {
      filter: { waitlist_entry_id: waitlistEntryId },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "id", order: "DESC" },
    },
  );
  const target = invitations.find(
    (invitation) =>
      invitation.status === "sent" && invitation.booked_sales_call_id == null,
  );
  if (!target) return { applied: false };

  await dataProvider.update<WaitlistInvitation>("waitlist_invitations", {
    id: target.id,
    data: { booked_sales_call_id: salesCallId, booked_at: bookedAt },
    previousData: target,
  });
  return { applied: true };
};
