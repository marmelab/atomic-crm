import type { DataProvider, Identifier } from "ra-core";

// Whether a Program can be deleted, or only archived.
//
// The database is not enough here, and it is worth being precise about
// where it stops. deals.cohort_id and applications.intended_cohort_id have
// no ON DELETE rule, so Postgres refuses to delete a Cohort that has
// Opportunities or Applications — good. But waitlist_entries.cohort_id is
// ON DELETE CASCADE, so deleting a Cohort would take its waiting list with
// it, silently. The January 2027 round has fifty-one people on it.
//
// So the rule lives here, in front of the delete, and it is deliberately
// broader than the foreign keys: anything that represents a real person's
// history with this Program blocks deletion. An accidental empty Program —
// a test row, a mis-click — still deletes cleanly after confirmation,
// which is the only case hard deletion is for.
//
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
      // The one the database would have cascaded away.
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
export const offerDeleteSafety = async (
  dataProvider: DataProvider,
  offerId: Identifier,
): Promise<DeleteSafety> => {
  const [opportunities, cohorts, waitlist, applications] = await Promise.all([
    countOf(dataProvider, "deals", { offer_id: offerId }),
    countOf(dataProvider, "cohorts", { offer_id: offerId }),
    countOf(dataProvider, "waitlist_entries", { offer_id: offerId }),
    countOf(dataProvider, "applications", { offer_id: offerId }),
  ]);

  return blocking([
    { label: "Opportunities", count: opportunities },
    { label: "rounds", count: cohorts },
    { label: "people waiting", count: waitlist },
    { label: "Applications", count: applications },
  ]);
};

// "7 Opportunities, 51 people waiting" — what the refusal actually says,
// so Leif can see why and go and look rather than being told "no".
export const describeLinks = (links: ProgramLink[]): string =>
  links.map((link) => `${link.count} ${link.label}`).join(", ");
