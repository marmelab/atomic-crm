import type { DataProvider, Identifier } from "ra-core";

// Whether a Program can be deleted, or only archived.
//
// This is the first of two layers, and the only one that can hold a
// conversation. Since 20260921180000 the database independently refuses
// every one of these deletions — before it, waitlist_entries.cohort_id was
// ON DELETE CASCADE and a round's waiting list went with the round,
// silently; the January 2027 round has fifty-one people on it.
//
// Having both is the point. The database cannot tell Leif that the round
// he is about to delete has seven Opportunities and a waiting list behind
// it, or offer to archive it instead; it can only say 23503. This layer
// cannot protect a delete issued from a SQL console, a script, or a future
// screen that forgets to ask. So the two answer the same question and
// neither is the reason it is safe.
//
// What that costs: this list has to stay the same list the database
// refuses. A guard that asks fewer questions hands Leif a confirmation
// dialog followed by a raw foreign-key error, which is the guard failing.
//
// An accidental empty Program — a test row, a mis-click — still deletes
// cleanly after confirmation, which is the only case hard deletion is for.
// Archiving is always available and never destroys anything.

export type ProgramLink = {
  // What it is, in Leif's words — this is shown to him.
  label: string;
  count: number;
};

export type DeleteSafety =
  | { deletable: true }
  | { deletable: false; links: ProgramLink[] };

const blocking = (links: ProgramLink[]): DeleteSafety => {
  const real = links.filter((link) => link.count > 0);
  return real.length === 0
    ? { deletable: true }
    : { deletable: false, links: real };
};

const countOf = async (
  dataProvider: DataProvider,
  resource: string,
  filter: Record<string, unknown>,
): Promise<number> => {
  try {
    const { total } = await dataProvider.getList(resource, {
      filter,
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
    });
    return total ?? 0;
  } catch {
    // A resource this deployment does not expose must never read as
    // "nothing linked" — that would turn an unknown into permission to
    // delete. Count it as blocking by reporting one.
    return 1;
  }
};

// A group round. Everything below is somebody's history with it.
export const cohortDeleteSafety = async (
  dataProvider: DataProvider,
  cohortId: Identifier,
): Promise<DeleteSafety> => {
  const [opportunities, applications, waitlist, invitations] =
    await Promise.all([
      countOf(dataProvider, "deals", { cohort_id: cohortId }),
      countOf(dataProvider, "applications", { intended_cohort_id: cohortId }),
      // The one the database used to cascade away.
      countOf(dataProvider, "waitlist_entries", { cohort_id: cohortId }),
      countOf(dataProvider, "waitlist_invitation_batches", {
        cohort_id: cohortId,
      }),
    ]);

  return blocking([
    { label: "Opportunities", count: opportunities },
    { label: "Applications", count: applications },
    { label: "people waiting", count: waitlist },
    { label: "invitations sent", count: invitations },
  ]);
};

// A Program itself. A group Program owns rounds; deleting one would take
// every round with it, so a Program with any round is not disposable
// either.
//
// This list is deliberately the same list the database now refuses
// (20260921180000). The database is the backstop and it answers with a
// foreign-key violation; this answers with what is actually linked and an
// offer to archive instead. Letting the two drift would mean Leif reaching
// a confirmation dialog and then a raw refusal — which is the guard
// failing, not the guard working.
export const offerDeleteSafety = async (
  dataProvider: DataProvider,
  offerId: Identifier,
): Promise<DeleteSafety> => {
  const [
    opportunities,
    cohorts,
    waitlist,
    applications,
    sessions,
    scholarships,
  ] = await Promise.all([
    countOf(dataProvider, "deals", { offer_id: offerId }),
    countOf(dataProvider, "cohorts", { offer_id: offerId }),
    countOf(dataProvider, "waitlist_entries", { offer_id: offerId }),
    countOf(dataProvider, "applications", { offer_id: offerId }),
    // Attendance. enrollment_id is nullable, so a session booked by
    // somebody who never enrolled has nothing else holding it up.
    countOf(dataProvider, "client_sessions", { offer_id: offerId }),
    countOf(dataProvider, "scholarship_slots", { offer_id: offerId }),
  ]);

  return blocking([
    { label: "Opportunities", count: opportunities },
    { label: "rounds", count: cohorts },
    { label: "people waiting", count: waitlist },
    { label: "Applications", count: applications },
    { label: "sessions", count: sessions },
    { label: "scholarship places", count: scholarships },
  ]);
};

// "7 Opportunities, 51 people waiting" — what the refusal actually says,
// so Leif can see why and go and look rather than being told "no".
export const describeLinks = (links: ProgramLink[]): string =>
  links.map((link) => `${link.count} ${link.label}`).join(", ");
