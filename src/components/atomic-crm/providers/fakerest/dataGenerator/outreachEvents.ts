import { random } from "faker/locale/en_US";

import type { OutreachEvent, OutreachEventType } from "../../../types";
import type { Db } from "./types";

// The event trail that leads to each outreach status, oldest first.
const STATUS_SEQUENCE: Record<string, OutreachEventType[]> = {
  queued: ["queued"],
  emailed: ["queued", "emailed"],
  opened: ["queued", "emailed", "opened"],
  replied: ["queued", "emailed", "opened", "replied"],
  interested: ["queued", "emailed", "opened", "replied", "interested"],
  meeting_booked: [
    "queued",
    "emailed",
    "opened",
    "replied",
    "interested",
    "meeting_booked",
  ],
  closed: [
    "queued",
    "emailed",
    "opened",
    "replied",
    "interested",
    "meeting_booked",
    "closed",
  ],
  bounced: ["queued", "emailed", "bounced"],
  unsubscribed: ["queued", "emailed", "opened", "unsubscribed"],
  not_interested: ["queued", "emailed", "opened", "replied", "not_interested"],
  wrong_person: ["queued", "emailed", "wrong_person"],
};

const REPLY_SNIPPETS = [
  "Thanks for reaching out — can you send more details?",
  "Not the right time, but check back next quarter.",
  "Sure, let's set up a quick call this week.",
];

const FIVE_HOURS = 5 * 60 * 60 * 1000;

const summaryFor = (type: OutreachEventType): string | null => {
  if (type === "replied") return random.arrayElement(REPLY_SNIPPETS);
  if (type === "bounced") return "Mailbox does not exist";
  return null;
};

export const generateOutreachEvents = (db: Db): OutreachEvent[] => {
  const events: OutreachEvent[] = [];
  let id = 0;

  for (const contact of db.contacts) {
    const status = contact.outreach_status;
    if (!status || status === "not_contacted") continue;

    const sequence = STATUS_SEQUENCE[status] ?? ["queued"];
    const base = new Date(
      contact.last_outreach_at ?? contact.last_seen ?? Date.now(),
    ).getTime();

    sequence.forEach((type, i) => {
      const occurredAt = new Date(base + i * FIVE_HOURS).toISOString();
      events.push({
        id: id++,
        contact_id: contact.id,
        type,
        campaign: contact.instantly_campaign ?? null,
        summary: summaryFor(type),
        occurred_at: occurredAt,
        payload: null,
        created_at: occurredAt,
      });
    });
  }

  return events;
};
