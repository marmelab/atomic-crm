import type { SalesCall } from "../types";
import { scheduleDate } from "./salesCallSchedule";

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
// The order that answers the real question:
//
//   1. a call that is still BOOKED — there is something in the calendar,
//      and that outranks anything already concluded
//   2. otherwise the call that happened most recently
//
// Ties break on id descending, so two calls on the same day resolve to the
// more recently recorded one rather than arbitrarily.
export type SalesCallOrdering = {
  current: SalesCall | null;
  history: SalesCall[];
};

const scheduleKey = (call: SalesCall): string =>
  scheduleDate(call) ?? "0000-00-00";

const byMostRecentSchedule = (a: SalesCall, b: SalesCall): number => {
  const byDate = scheduleKey(b).localeCompare(scheduleKey(a));
  if (byDate !== 0) return byDate;
  return Number(b.id) - Number(a.id);
};

export const selectCurrentSalesCall = (
  salesCalls: readonly SalesCall[] | undefined,
): SalesCallOrdering => {
  if (!salesCalls?.length) return { current: null, history: [] };

  const ordered = [...salesCalls].sort(byMostRecentSchedule);
  const booked = ordered.filter((call) => call.status === "booked");
  const current = booked[0] ?? ordered[0];

  return {
    current,
    // Everything else, most recent first — the compact record of what
    // already happened with this person.
    history: ordered.filter((call) => String(call.id) !== String(current.id)),
  };
};

// What the drawer should call the current call's state, in the words Leif
// uses. Deliberately reads the call's own columns rather than the
// Opportunity's stage: the stage can lag, and the call is the fact.
export const describeSalesCallState = (call: SalesCall): string => {
  if (call.status === "cancelled") return "Cancelled";
  if (call.attendance === "no_show") return "No-show";
  if (call.attendance === "attended") return "Call happened";
  if (call.status === "booked") return "Booked";
  return "Outcome not recorded";
};
