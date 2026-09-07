import type { ClientSession, EnrollmentExpectedSession } from "../types";

// Shared between ClientShow's own Attention row and
// CadenceResolutionModal.tsx — a no-show'd session inside the slot gets
// more specific copy ("Sep 3 session marked no-show") than a plain
// never-booked week ("No session booked"); both are the SAME underlying
// unresolved issue, just worded from what actually happened. One
// implementation so both surfaces always agree.
export const findNoShowSessionInSlot = (
  sessions: ClientSession[],
  slot: Pick<EnrollmentExpectedSession, "window_start" | "window_end">,
) =>
  sessions.find(
    (session) =>
      session.no_show_at &&
      new Date(session.scheduled_at) >= new Date(slot.window_start) &&
      new Date(session.scheduled_at) < new Date(slot.window_end),
  ) ?? null;
