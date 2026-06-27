// Maps an Instantly webhook event to the CRM changes it should cause. Pure +
// unit-tested. Kept self-contained (Deno can't import from the Vite app); the
// status funnel mirrors src/components/atomic-crm/misc/outreachStatus.ts.

export type OutreachEventType =
  | "queued"
  | "emailed"
  | "opened"
  | "clicked"
  | "replied"
  | "bounced"
  | "interested"
  | "not_interested"
  | "neutral"
  | "meeting_booked"
  | "closed"
  | "unsubscribed"
  | "wrong_person";

export type OutreachStatus =
  | "not_contacted"
  | "queued"
  | "emailed"
  | "opened"
  | "replied"
  | "interested"
  | "meeting_booked"
  | "closed"
  | "bounced"
  | "unsubscribed"
  | "not_interested"
  | "wrong_person";

export interface MappedEvent {
  type: OutreachEventType;
  addNote: boolean;
  markEmailInvalid: boolean;
  addTag: string | null;
}

// Instantly webhook event_type (lowercased) → CRM handling. Unlisted events
// (campaign_completed, email_account_error, lead_out_of_office, …) return null
// and are acknowledged without changing the contact.
const EVENT_MAP: Record<string, MappedEvent> = {
  email_sent: {
    type: "emailed",
    addNote: false,
    markEmailInvalid: false,
    addTag: null,
  },
  email_opened: {
    type: "opened",
    addNote: false,
    markEmailInvalid: false,
    addTag: null,
  },
  email_link_clicked: {
    type: "clicked",
    addNote: false,
    markEmailInvalid: false,
    addTag: null,
  },
  email_clicked: {
    type: "clicked",
    addNote: false,
    markEmailInvalid: false,
    addTag: null,
  },
  reply_received: {
    type: "replied",
    addNote: true,
    markEmailInvalid: false,
    addTag: null,
  },
  email_bounced: {
    type: "bounced",
    addNote: false,
    markEmailInvalid: true,
    addTag: null,
  },
  lead_unsubscribed: {
    type: "unsubscribed",
    addNote: false,
    markEmailInvalid: false,
    addTag: "Unsubscribed",
  },
  lead_interested: {
    type: "interested",
    addNote: false,
    markEmailInvalid: false,
    addTag: null,
  },
  lead_not_interested: {
    type: "not_interested",
    addNote: false,
    markEmailInvalid: false,
    addTag: null,
  },
  lead_neutral: {
    type: "neutral",
    addNote: false,
    markEmailInvalid: false,
    addTag: null,
  },
  lead_meeting_booked: {
    type: "meeting_booked",
    addNote: false,
    markEmailInvalid: false,
    addTag: null,
  },
  lead_meeting_completed: {
    type: "meeting_booked",
    addNote: false,
    markEmailInvalid: false,
    addTag: null,
  },
  lead_closed: {
    type: "closed",
    addNote: false,
    markEmailInvalid: false,
    addTag: null,
  },
  lead_wrong_person: {
    type: "wrong_person",
    addNote: false,
    markEmailInvalid: false,
    addTag: "Wrong person",
  },
};

export const mapInstantlyEvent = (
  eventType: string | undefined | null,
): MappedEvent | null => {
  if (!eventType) return null;
  return EVENT_MAP[eventType.toLowerCase()] ?? null;
};

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

const TERMINAL_NEGATIVE: OutreachStatus[] = [
  "bounced",
  "unsubscribed",
  "not_interested",
  "wrong_person",
];

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
