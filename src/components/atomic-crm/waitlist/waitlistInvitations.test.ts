import { describe, expect, it } from "vitest";
import type { DataProvider } from "ra-core";

import { createDataProvider } from "../providers/fakerest/dataProvider";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import type {
  Application,
  Deal,
  Enrollment,
  Offer,
  WaitlistEntry,
  WaitlistInvitation,
} from "../types";
import { markInvited, removeFromWaitlist } from "./waitlistActions";
import {
  attributeBookingToInvitation,
  isInvitable,
  prepareInvitationBatch,
  recordInvitationFailed,
  recordInvitationSent,
} from "./waitlistInvitations";

// Waitlist invitation foundation. The business event Gmail will later
// deliver — modelled as durable records rather than a single status,
// because a membership can be invited more than once over its life.

const LE_OFFER_ID = 1;
const livingExample: Offer = {
  id: LE_OFFER_ID,
  name: "The Living Example",
  type: "individual",
  duration: "4 months",
  current_price: 4000,
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const entry = (
  id: number,
  contactId: number,
  overrides: Partial<WaitlistEntry> = {},
): WaitlistEntry =>
  ({
    id,
    contact_id: contactId,
    offer_id: LE_OFFER_ID,
    cohort_id: null,
    status: "waiting",
    joined_at: "2026-08-01T00:00:00.000Z",
    source: "manual",
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  }) as WaitlistEntry;

const buildProvider = (entries: WaitlistEntry[]) =>
  createDataProvider({
    db: createCrmDb({
      contacts: [1, 2, 3, 4].map((id) => buildContact({ id })),
      offers: [livingExample],
      cohorts: [],
      deals: [],
      applications: [],
      enrollments: [],
      sales_calls: [],
      waitlist_entries: entries,
      waitlist_invitation_batches: [],
      waitlist_invitations: [],
      tasks: [],
    } as any),
    silent: true,
    latency: 0,
  });

const listInvitations = async (
  dataProvider: DataProvider,
  filter: object = {},
): Promise<WaitlistInvitation[]> =>
  (
    await dataProvider.getList<WaitlistInvitation>("waitlist_invitations", {
      filter,
      pagination: { page: 1, perPage: 100 },
      sort: { field: "id", order: "ASC" },
    })
  ).data;

describe("waitlist invitation batches", () => {
  it("creates one invitation per selected membership", async () => {
    const dataProvider = buildProvider([entry(1, 1), entry(2, 2), entry(3, 3)]);
    const { batch, invitations } = await prepareInvitationBatch(dataProvider, {
      offerId: LE_OFFER_ID,
      entryIds: [1, 2, 3],
    });
    expect(batch.status).toBe("prepared");
    expect(invitations).toHaveLength(3);
    expect(invitations.map((i) => i.waitlist_entry_id).sort()).toEqual([
      1, 2, 3,
    ]);
    expect(invitations.every((i) => i.status === "prepared")).toBe(true);
  });

  it("excludes converted and removed memberships rather than silently inviting them", async () => {
    const dataProvider = buildProvider([
      entry(1, 1),
      entry(2, 2, { status: "converted" }),
      entry(3, 3, { status: "removed" }),
    ]);
    expect(isInvitable(entry(2, 2, { status: "converted" }))).toBe(false);
    expect(isInvitable(entry(3, 3, { status: "removed" }))).toBe(false);

    const { invitations, skippedEntryIds } = await prepareInvitationBatch(
      dataProvider,
      { offerId: LE_OFFER_ID, entryIds: [1, 2, 3] },
    );
    expect(invitations).toHaveLength(1);
    expect(invitations[0]!.waitlist_entry_id).toBe(1);
    expect(skippedEntryIds.sort()).toEqual([2, 3]);
  });

  it("allows a previously invited membership to be invited again", async () => {
    const dataProvider = buildProvider([entry(1, 1, { status: "invited" })]);
    const { invitations } = await prepareInvitationBatch(dataProvider, {
      offerId: LE_OFFER_ID,
      entryIds: [1],
    });
    expect(invitations).toHaveLength(1);
  });

  it("keeps every invitation when one membership is invited across multiple batches", async () => {
    const dataProvider = buildProvider([entry(1, 1)]);
    await prepareInvitationBatch(dataProvider, {
      offerId: LE_OFFER_ID,
      entryIds: [1],
    });
    await prepareInvitationBatch(dataProvider, {
      offerId: LE_OFFER_ID,
      entryIds: [1],
    });
    await prepareInvitationBatch(dataProvider, {
      offerId: LE_OFFER_ID,
      entryIds: [1],
    });

    const invitations = await listInvitations(dataProvider, {
      waitlist_entry_id: 1,
    });
    // Three separate asks — exactly what a single status could not record.
    expect(invitations).toHaveLength(3);
    expect(new Set(invitations.map((i) => i.batch_id)).size).toBe(3);
  });

  it("collapses a duplicated selection within ONE batch to a single invitation", async () => {
    const dataProvider = buildProvider([entry(1, 1)]);
    const { invitations } = await prepareInvitationBatch(dataProvider, {
      offerId: LE_OFFER_ID,
      entryIds: [1, 1, 1],
    });
    expect(invitations).toHaveLength(1);
  });

  it("does not claim anything was emailed, and does not mark anyone Invited", async () => {
    const dataProvider = buildProvider([entry(1, 1), entry(2, 2)]);
    const { invitations } = await prepareInvitationBatch(dataProvider, {
      offerId: LE_OFFER_ID,
      entryIds: [1, 2],
    });

    expect(invitations.every((i) => i.sent_at == null)).toBe(true);
    expect(invitations.every((i) => i.delivery_method == null)).toBe(true);

    // Membership follows delivery, never selection.
    for (const id of [1, 2]) {
      const { data: after } = await dataProvider.getOne<WaitlistEntry>(
        "waitlist_entries",
        { id },
      );
      expect(after.status).toBe("waiting");
      expect(after.invited_at ?? null).toBeNull();
    }
  });

  it("creates no Application, Deal or Enrollment", async () => {
    const dataProvider = buildProvider([entry(1, 1)]);
    await prepareInvitationBatch(dataProvider, {
      offerId: LE_OFFER_ID,
      entryIds: [1],
    });
    const page = {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" as const },
      filter: {},
    };
    expect(
      (await dataProvider.getList<Application>("applications", page)).data,
    ).toHaveLength(0);
    expect((await dataProvider.getList<Deal>("deals", page)).data).toHaveLength(
      0,
    );
    expect(
      (await dataProvider.getList<Enrollment>("enrollments", page)).data,
    ).toHaveLength(0);
  });
});

describe("per-person delivery outcomes", () => {
  it("transitions only the delivered person's membership", async () => {
    const dataProvider = buildProvider([entry(1, 1), entry(2, 2)]);
    const { invitations } = await prepareInvitationBatch(dataProvider, {
      offerId: LE_OFFER_ID,
      entryIds: [1, 2],
    });

    await recordInvitationSent(dataProvider, invitations[0]!.id, "gmail");

    const { data: delivered } = await dataProvider.getOne<WaitlistEntry>(
      "waitlist_entries",
      { id: invitations[0]!.waitlist_entry_id },
    );
    const { data: untouched } = await dataProvider.getOne<WaitlistEntry>(
      "waitlist_entries",
      { id: invitations[1]!.waitlist_entry_id },
    );
    expect(delivered.status).toBe("invited");
    expect(delivered.invited_at).toBeTruthy();
    // Nobody is marked invited because somebody else's send succeeded.
    expect(untouched.status).toBe("waiting");
  });

  it("leaves a failed send retryable and changes nobody's membership", async () => {
    const dataProvider = buildProvider([entry(1, 1), entry(2, 2)]);
    const { invitations } = await prepareInvitationBatch(dataProvider, {
      offerId: LE_OFFER_ID,
      entryIds: [1, 2],
    });

    await recordInvitationSent(dataProvider, invitations[0]!.id, "gmail");
    await recordInvitationFailed(dataProvider, invitations[1]!.id, "bounced");

    const all = await listInvitations(dataProvider);
    const failed = all.find((i) => i.id === invitations[1]!.id)!;
    expect(failed.status).toBe("failed");
    expect(failed.failure_reason).toBe("bounced");
    expect(failed.sent_at ?? null).toBeNull();

    const { data: entryTwo } = await dataProvider.getOne<WaitlistEntry>(
      "waitlist_entries",
      { id: 2 },
    );
    expect(entryTwo.status).toBe("waiting");

    // The successful one is unaffected by the other's failure.
    const { data: entryOne } = await dataProvider.getOne<WaitlistEntry>(
      "waitlist_entries",
      { id: 1 },
    );
    expect(entryOne.status).toBe("invited");
  });

  it("records a booking against the open invitation, answering follow-up eligibility", async () => {
    const dataProvider = buildProvider([entry(1, 1)]);
    const { invitations } = await prepareInvitationBatch(dataProvider, {
      offerId: LE_OFFER_ID,
      entryIds: [1],
    });
    await recordInvitationSent(dataProvider, invitations[0]!.id, "gmail");

    const { data: call } = await dataProvider.create("sales_calls", {
      data: {
        contact_id: 1,
        opportunity_id: null,
        status: "booked",
        original_scheduled_at: "2026-10-03T15:00:00.000Z",
        scheduled_at: "2026-10-03T15:00:00.000Z",
        reschedule_count: 0,
        source: "acuity",
      },
    });

    const result = await attributeBookingToInvitation(dataProvider, {
      waitlistEntryId: 1,
      salesCallId: call.id,
      bookedAt: "2026-10-03T15:00:00.000Z",
    });
    expect(result.applied).toBe(true);

    const [invitation] = await listInvitations(dataProvider, {
      waitlist_entry_id: 1,
    });
    expect(invitation!.booked_sales_call_id).toBe(call.id);
    expect(invitation!.booked_at).toBeTruthy();
  });
});

describe("individual invite shares the canonical model", () => {
  it("markInvited records a real invitation, not just a status change", async () => {
    const dataProvider = buildProvider([entry(1, 1)]);
    const result = await markInvited(dataProvider, 1);
    expect(result.applied).toBe(true);

    const invitations = await listInvitations(dataProvider, {
      waitlist_entry_id: 1,
    });
    expect(invitations).toHaveLength(1);
    // Leif sent it himself — recorded truthfully, never as a Gmail send.
    expect(invitations[0]!.status).toBe("sent");
    expect(invitations[0]!.delivery_method).toBe("manual");
    expect(invitations[0]!.sent_at).toBeTruthy();

    const { data: after } = await dataProvider.getOne<WaitlistEntry>(
      "waitlist_entries",
      { id: 1 },
    );
    expect(after.status).toBe("invited");
  });

  it("refuses to invite a removed membership", async () => {
    const dataProvider = buildProvider([entry(1, 1, { status: "removed" })]);
    const result = await markInvited(dataProvider, 1);
    expect(result.applied).toBe(false);
    expect(await listInvitations(dataProvider)).toHaveLength(0);
  });

  it("leaves existing removal history behaviour unchanged", async () => {
    const dataProvider = buildProvider([entry(1, 1)]);
    await markInvited(dataProvider, 1);
    const removal = await removeFromWaitlist(dataProvider, 1);
    expect(removal.applied).toBe(true);

    const { data: after } = await dataProvider.getOne<WaitlistEntry>(
      "waitlist_entries",
      { id: 1 },
    );
    expect(after.status).toBe("removed");
    expect(after.removed_at).toBeTruthy();
    // The invitation that happened before the removal is still history.
    expect(await listInvitations(dataProvider)).toHaveLength(1);
  });
});
