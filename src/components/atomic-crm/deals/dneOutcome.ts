import type { DataProvider, Identifier } from "ra-core";

import type { Deal } from "../types";

// Centralizes the "owner chose Do Not Engage" write pattern — previously
// inline in reviewApplication.ts alone, now shared with sales-calls/
// completeSalesCallOutcome.ts (Acuity/Sales Call Lifecycle slice §DNE:
// "Do not duplicate DNE logic"). No 'do_not_engage' Opportunity outcome
// exists in the schema, and none is needed: the Contact-level
// sales_eligibility flag is the durable signal. This Opportunity exits the
// active pipeline like any other decline (outcome: 'lost'), with
// owner_decision recording the specific reason.
export const buildDoNotEngageDealUpdate = (): Pick<
  Deal,
  "outcome" | "owner_decision"
> => ({ outcome: "lost", owner_decision: "do_not_engage" });

// Sets the durable Contact-level DNE flag. Never erases/deletes the
// Contact, never touches unrelated Opportunity/Application/Sales Call
// history — those stay exactly as they happened.
export const applyDoNotEngageToContact = async (
  dataProvider: DataProvider,
  contactId: Identifier,
): Promise<void> => {
  const { data: contact } = await dataProvider.getOne("contacts", {
    id: contactId,
  });
  await dataProvider.update("contacts", {
    id: contactId,
    data: { sales_eligibility: "do_not_engage" },
    previousData: contact,
  });
};
