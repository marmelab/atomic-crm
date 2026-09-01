// FakeRest defense-in-depth for the "at most one booked call per
// Opportunity" rule (Acuity/Sales Call Lifecycle slice) — mirrors
// waitlist/waitlistEntryValidation.ts's own documented convention exactly:
// the real DB's partial unique index
// (sales_calls_one_booked_per_opportunity_idx) is defense-in-depth for
// direct SQL/races; FakeRest has no constraint engine at all, so this is
// the only thing that can enforce the rule there. bookSalesCall.ts's own
// find-or-retarget logic is expected to never trigger this in normal use
// (it always reuses/updates an existing booked row rather than creating a
// second one) — this hook exists to fail loudly rather than silently
// corrupt data if that's ever bypassed (a direct dataProvider.create call,
// a bug, a race).
import type { DataProvider, Identifier } from "ra-core";

import type { SalesCall } from "../types";

export class DuplicateBookedSalesCallError extends Error {}

export const assertNoDuplicateBookedSalesCall = async (
  dataProvider: DataProvider,
  {
    opportunityId,
    excludeSalesCallId,
  }: {
    opportunityId: Identifier | null | undefined;
    excludeSalesCallId?: Identifier;
  },
): Promise<void> => {
  if (opportunityId == null) return;

  const { data: existing } = await dataProvider.getList<SalesCall>(
    "sales_calls",
    {
      filter: { opportunity_id: opportunityId, status: "booked" },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    },
  );
  const conflict = existing.find(
    (call) =>
      excludeSalesCallId == null ||
      String(call.id) !== String(excludeSalesCallId),
  );
  if (conflict) {
    throw new DuplicateBookedSalesCallError(
      `Opportunity ${opportunityId} already has a booked Sales Call (#${conflict.id})`,
    );
  }
};
