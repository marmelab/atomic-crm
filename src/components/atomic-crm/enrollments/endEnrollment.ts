import type { DataProvider, Identifier } from "ra-core";

import type { Enrollment } from "../types";

// The two ways an engagement stops without being completed.
//
// Both statuses already existed and neither had any way to reach them
// except the historical importer, so a client who left was either left
// sitting in Active — appearing as somebody Leif is currently working with
// — or quietly marked Completed, which says on their own record that they
// finished a programme they did not finish.
//
// They are deliberately two words rather than one with a reason field.
// This slice is not the place to invent a taxonomy of why people leave;
// the distinction that actually changes how a record reads is whether the
// PERSON stopped or the CONTAINER did.
export type TerminalOutcome =
  // The client exited before normal completion. A fact about them.
  | "withdrawn"
  // The engagement ended administratively and "completed" would be the
  // wrong word. Neutral by design: it describes the container.
  | "ended";

export type EndEnrollmentResult =
  | { applied: true; status: TerminalOutcome }
  | { applied: false; reason: "already-terminal"; status: string };

const TERMINAL_STATUSES: ReadonlySet<string> = new Set([
  "completed",
  "withdrawn",
  "ended",
]);

// Moves an Enrollment to a terminal status.
//
// What it deliberately does NOT do:
//
//   It does not touch the offboarding checklist. Somebody who withdrew
//   halfway did not complete an offboarding process, and marking those
//   items done to tidy the record would be recording work nobody did.
//
//   It does not set an end_date. The date somebody stopped is not the date
//   the CRM was told, and inventing one would put a fabricated date into
//   the Past ordering, which reads end dates as evidence.
//
//   It does not remove access or cancel integrations. Nothing deterministic
//   exists to do that today, and a half-built teardown is worse than none.
//
// The status event trigger records the transition, so when Leif was told
// is preserved without pretending it is when it happened.
export const endEnrollment = async (
  dataProvider: DataProvider,
  enrollmentId: Identifier,
  outcome: TerminalOutcome,
): Promise<EndEnrollmentResult> => {
  // Re-read rather than trusting the caller's copy, so a double-click or a
  // stale tab is a no-op instead of a second write.
  const { data: enrollment } = await dataProvider.getOne<Enrollment>(
    "enrollments",
    { id: enrollmentId },
  );

  if (TERMINAL_STATUSES.has(enrollment.status)) {
    return {
      applied: false,
      reason: "already-terminal",
      status: enrollment.status,
    };
  }

  await dataProvider.update("enrollments", {
    id: enrollment.id,
    data: { status: outcome },
    previousData: enrollment,
  });

  return { applied: true, status: outcome };
};
