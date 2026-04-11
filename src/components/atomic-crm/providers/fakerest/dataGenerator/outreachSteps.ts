import { datatype, random } from "faker/locale/en_US";

import type { OutreachStep } from "../../../types";
import type { Db } from "./types";

const subjectTemplates = [
  "Helping {{trade}} teams in {{city}} tighten follow-up",
  "A practical way to speed up quote turnaround for {{business}}",
  "Reducing admin drag for {{trade}} crews across the GTA",
];

const firstTouchTemplates = [
  "Hi {{business}} team,\n\nI work with GTA construction businesses that are juggling estimates, callbacks, and job scheduling across a busy week. We usually find a few manual steps that can be automated without changing how the crew actually works.\n\nIf streamlining quote follow-up or inbound lead response is a priority this quarter, I can share a few concrete ideas tailored to {{trade}} shops in {{city}}.\n\nBest,\nNathan",
  "Hi {{business}} team,\n\nI was looking through established {{trade}} companies in {{city}} and your name came up. Most firms we speak with already have strong field operations, but office coordination and follow-up still pull owners into too much admin.\n\nI build practical automation for contractors in the GTA. If useful, I can send over a few examples that cut down estimate chasing and missed callbacks.\n\nBest,\nNathan",
];

const followUpTemplates = [
  "Hi {{business}} team,\n\nFollowing up on my earlier note. We have been helping contractors around {{city}} reduce lead-response delays and keep estimate requests moving without adding more office overhead.\n\nIf that is relevant for {{business}}, I can outline a simple workflow for your current process.\n\nBest,\nNathan",
  "Hi {{business}} team,\n\nWanted to circle back in case my last email got buried. A lot of {{trade}} businesses we work with in the GTA were losing time to scattered inboxes, manual reminders, and slow estimate follow-up.\n\nIf you want, I can send a short breakdown of where automation usually has the fastest payoff.\n\nRegards,\nNathan",
];

const reviewTemplates = [
  {
    subject: "Could {{business}} use faster follow-up on incoming quote requests?",
    body: "Hi {{business}} team,\n\nI put together a few ideas specifically for {{trade}} companies in {{city}} that want tighter response times without adding another admin hire. Happy to share a concise breakdown if that would be useful.\n\nBest,\nNathan",
  },
  {
    subject: "Quick idea for reducing admin bottlenecks at {{business}}",
    body: "Hi {{business}} team,\n\nI work with construction businesses across the GTA on practical systems for lead intake, estimating, and client follow-up. I think there may be a few straightforward wins for your team.\n\nIf helpful, I can send over two or three ideas tailored to how {{trade}} shops usually operate.\n\nBest,\nNathan",
  },
];

const linkedinTemplates = [
  "Connect with the owner or estimator at {{business}} and keep the note concise. Reference faster estimate follow-up for {{trade}} work in {{city}}.",
  "Prep a LinkedIn follow-up that mentions GTA project volume, callback speed, and reducing office bottlenecks for {{business}}.",
];

const fillTemplate = (
  template: string,
  lead: Db["intake_leads"][number],
  tradeName: string,
) =>
  template
    .replaceAll("{{business}}", lead.business_name)
    .replaceAll("{{city}}", lead.city ?? "the GTA")
    .replaceAll("{{trade}}", tradeName);

export const generateOutreachSteps = (db: Db): OutreachStep[] => {
  let id = 1;

  return db.intake_leads
    .filter((lead) => lead.status === "in-sequence" || lead.status === "engaged")
    .flatMap((lead) => {
      const tradeName =
        db.trade_types.find((trade) => trade.id === lead.trade_type_id)?.name ??
        "construction";
      const firstSentAt = new Date(
        Date.now() - datatype.number({ min: 10, max: 14 }) * 86400000,
      );
      const secondSentAt = new Date(
        Date.now() - datatype.number({ min: 3, max: 7 }) * 86400000,
      );
      const reviewCreatedAt = new Date(
        Date.now() - datatype.number({ min: 1, max: 2 }) * 86400000,
      );
      const reviewTemplate = random.arrayElement(reviewTemplates);
      const steps: OutreachStep[] = [
        {
          id: id++,
          intake_lead_id: String(lead.id),
          sequence_step: 1,
          channel: "email",
          subject: fillTemplate(
            random.arrayElement(subjectTemplates),
            lead,
            tradeName,
          ),
          body: fillTemplate(
            random.arrayElement(firstTouchTemplates),
            lead,
            tradeName,
          ),
          review_status: "passed",
          review_feedback: null,
          status: "sent",
          provider_message_id: `msg-${lead.id}-1`,
          reply_body: null,
          reply_received_at: null,
          run_id: `run-${lead.id}`,
          created_at: new Date(firstSentAt.getTime() - 86400000).toISOString(),
          sent_at: firstSentAt.toISOString(),
        },
        {
          id: id++,
          intake_lead_id: String(lead.id),
          sequence_step: 2,
          channel: "email",
          subject: `Following up for ${lead.business_name} on ${tradeName.toLowerCase()} workflow improvements`,
          body: fillTemplate(
            random.arrayElement(followUpTemplates),
            lead,
            tradeName,
          ),
          review_status: "passed",
          review_feedback: null,
          status: "sent",
          provider_message_id: `msg-${lead.id}-2`,
          reply_body: null,
          reply_received_at: null,
          run_id: `run-${lead.id}`,
          created_at: new Date(secondSentAt.getTime() - 43200000).toISOString(),
          sent_at: secondSentAt.toISOString(),
        },
        {
          id: id++,
          intake_lead_id: String(lead.id),
          sequence_step: 3,
          channel: "email",
          subject: fillTemplate(reviewTemplate.subject, lead, tradeName),
          body: fillTemplate(reviewTemplate.body, lead, tradeName),
          review_status: "pending",
          review_feedback: null,
          status: "ai_reviewed",
          provider_message_id: null,
          reply_body: null,
          reply_received_at: null,
          run_id: `run-${lead.id}`,
          created_at: reviewCreatedAt.toISOString(),
          sent_at: null,
        },
      ];

      if (datatype.boolean()) {
        steps.push({
          id: id++,
          intake_lead_id: String(lead.id),
          sequence_step: 4,
          channel: "linkedin",
          subject: null,
          body: fillTemplate(
            random.arrayElement(linkedinTemplates),
            lead,
            tradeName,
          ),
          review_status: "failed",
          review_feedback:
            "Needs personalization before sending on LinkedIn.",
          status: "action_needed",
          provider_message_id: null,
          reply_body: null,
          reply_received_at: null,
          run_id: `run-${lead.id}`,
          created_at: new Date(reviewCreatedAt.getTime() + 3600000).toISOString(),
          sent_at: null,
        });
      }

      return steps;
    });
};
