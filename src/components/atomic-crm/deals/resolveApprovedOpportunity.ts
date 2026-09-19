import type { DataProvider, Identifier } from "ra-core";
import { isActiveOpportunity } from "./dealActivity";

import type { Deal } from "../types";

// Approved usually means "approved, and no call is currently booked" —
// which is exactly where Mihaela landed after Leif cancelled her call.
// There was no way to resolve somebody from there except dragging the card
// to a trash metaphor, which is wrong twice over: nothing is deleted, and
// "gone from my board" covers at least two different business meanings
// that Leif needs to tell apart later.
//
// These reuse the outcomes the app already has. No new stage and no new
// outcome value is introduced — Approved already exists, and waiting in it
// is a legitimate state rather than a gap to fill.
export type ApprovedResolution =
  // Stay Approved and wait for them to book. Explicitly an answer, so the
  // UI can offer "I looked at this and there is nothing to do yet" instead
  // of leaving Leif to wonder whether he forgot someone.
  | "await-booking"
  // Not now, but not over. Leaves the active pipeline; the relationship
  // stays real.
  | "nurture"
  // Over.
  | "lost";

export type ResolveApprovedResult =
  | { status: "resolved"; resolution: ApprovedResolution }
  | { status: "unchanged" }
  | { status: "not-found" }
  | { status: "already-resolved" };

export const resolveApprovedOpportunity = async (
  dataProvider: DataProvider,
  {
    opportunityId,
    resolution,
  }: { opportunityId: Identifier; resolution: ApprovedResolution },
): Promise<ResolveApprovedResult> => {
  const { data: deal } = await dataProvider
    .getOne<Deal>("deals", { id: opportunityId })
    .catch(() => ({ data: null as Deal | null }));
  if (!deal) return { status: "not-found" };

  if (
    deal.archived_at != null ||
    deal.outcome != null ||
    deal.stage === "won"
  ) {
    return { status: "already-resolved" };
  }

  // Keeping it Approved is a real answer, and the truthful implementation
  // of that answer is to change nothing. It must not invent a timestamp or
  // a stage event to look like it did something.
  if (resolution === "await-booking") {
    return { status: "unchanged" };
  }

  await dataProvider.update<Deal>("deals", {
    id: deal.id,
    data: { outcome: resolution === "nurture" ? "nurture" : "lost" },
    previousData: deal,
  });

  return { status: "resolved", resolution };
};

export const isAwaitingBooking = (
  deal: Pick<Deal, "stage" | "outcome" | "archived_at">,
): boolean => isActiveOpportunity(deal) && deal.stage === "approved";
