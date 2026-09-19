import type { SalesCall } from "../types";
import { selectSalesCalls } from "./salesCallSelection";

// Which of an Opportunity's sales calls is THE one to show.
//
// The drawer used to take the highest id and call it current. That is the
// most recently CREATED row, which is not the same question, and Mihaela
// Petrova is the proof: her 28 July Mini Deep Dive no-show was recorded
// after her 18 September GYU booking, so the higher id belongs to the
// EARLIER call. Her drawer therefore announced "No-show" as the current
// state of a relationship whose actual latest event was Leif cancelling
// the September call — the opposite of what he needed to see.
//
// The rule now lives in salesCallSelection.ts, which the board reads too,
// so the drawer and the Call Booked column can no longer describe the same
// relationship differently. This is the drawer's view of that one model,
// kept because its {current, history} shape is what the component wants.

export type SalesCallOrdering = {
  current: SalesCall | null;
  history: SalesCall[];
};

export const selectCurrentSalesCall = (
  salesCalls: readonly SalesCall[] | undefined,
): SalesCallOrdering => {
  const view = selectSalesCalls(salesCalls ?? []);
  return { current: view.current, history: view.history };
};

export { describeSalesCallState } from "./salesCallSelection";
