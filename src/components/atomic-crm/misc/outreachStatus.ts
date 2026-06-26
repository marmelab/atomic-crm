import type { OutreachEventType, OutreachStatus } from "../types";

// The positive funnel, in order. A contact's status only moves forward here.
const FUNNEL_ORDER: OutreachStatus[] = [
  "not_contacted",
  "queued",
  "emailed",
  "opened",
  "replied",
  "interested",
  "meeting_booked",
  "closed",
];

// Terminal negative states — these always win and are sticky once set.
const TERMINAL_NEGATIVE: OutreachStatus[] = [
  "bounced",
  "unsubscribed",
  "not_interested",
  "wrong_person",
];

// Advance a contact's outreach status. Forward-only along the funnel; a terminal
// negative state (bounced/unsubscribed/…) always wins and sticks, except that a
// newer terminal-negative replaces an older one.
export const advanceOutreachStatus = (
  current: OutreachStatus | null | undefined,
  next: OutreachStatus,
): OutreachStatus => {
  const cur = current ?? "not_contacted";

  if (TERMINAL_NEGATIVE.includes(next)) return next;
  if (TERMINAL_NEGATIVE.includes(cur)) return cur;

  const curIdx = FUNNEL_ORDER.indexOf(cur);
  const nextIdx = FUNNEL_ORDER.indexOf(next);
  if (nextIdx === -1) return cur;
  return nextIdx > curIdx ? next : cur;
};

// Map an Instantly event type to the outreach status it implies (or null when
// the event does not change the status, e.g. a "neutral" classification).
export const eventTypeToStatus = (
  type: OutreachEventType,
): OutreachStatus | null => {
  switch (type) {
    case "queued":
      return "queued";
    case "emailed":
      return "emailed";
    case "opened":
    case "clicked":
      return "opened";
    case "replied":
      return "replied";
    case "interested":
      return "interested";
    case "meeting_booked":
      return "meeting_booked";
    case "closed":
      return "closed";
    case "bounced":
      return "bounced";
    case "unsubscribed":
      return "unsubscribed";
    case "not_interested":
      return "not_interested";
    case "wrong_person":
      return "wrong_person";
    case "neutral":
      return null;
    default:
      return null;
  }
};
