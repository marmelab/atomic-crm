import { company, address, internet, phone, lorem, random } from "faker/locale/en_US";

import { randomDate } from "./utils";
import type { IntakeLead } from "../../../types";
import type { Db } from "./types";

const TRADE_TYPES = [
  { id: "tt_1", name: "Roofing" },
  { id: "tt_2", name: "HVAC" },
  { id: "tt_3", name: "Plumbing" },
  { id: "tt_4", name: "Electrical" },
  { id: "tt_5", name: "General Contracting" },
  { id: "tt_6", name: "Landscaping" },
  { id: "tt_7", name: "Painting" },
  { id: "tt_8", name: "Flooring" },
];

export const generateTradeTypes = () => TRADE_TYPES;

const statuses = ["new", "new", "new", "contacted", "responded", "qualified", "rejected"];
const sources = ["Google Places", "Referral", "Website Form", "Cold Outreach", "Trade Show", "Yelp"];

const enrichmentSamples = [
  "Established roofing company with 15+ years in residential and commercial projects. Strong Google reviews (4.6★, 230 reviews). Active on social media with regular project showcases. Owner-operated, 8-12 crew members.",
  "Mid-size HVAC contractor specializing in commercial installations. Recently expanded service area. Website is outdated but business appears active on BBB (A+ rating). Potential for workflow automation.",
  "Family-run plumbing business, 3rd generation. Primarily residential, some light commercial. No digital presence beyond a basic website. Strong word-of-mouth reputation in the community.",
  "Growing electrical contractor focused on new construction. Licensed for industrial work. Currently using pen-and-paper for estimates — strong automation opportunity.",
  null,
  null,
];

const outreachSamples = [
  "Hi [Owner],\n\nI came across your company while researching top-rated contractors in the GTA. Your reviews speak volumes — clearly your team delivers quality work.\n\nI help trade businesses like yours automate the back-office stuff that eats into your day — estimates, follow-ups, scheduling. Would you be open to a quick 15-min call to see if there's a fit?\n\nBest,\nNathan",
  "Hey [Owner],\n\nNoticed your company has been growing fast — congrats on the expansion. A lot of contractors in your position hit a wall with scheduling and client communication as they scale.\n\nWe build custom automations that handle that for you. No generic software — built specifically for how your business works. Worth a conversation?\n\nCheers,\nNathan",
  null,
  null,
];

const rejectionReasons = ["Not a fit", "Duplicate", "No contact info", "Out of area", "Other"];

export const generateIntakeLeads = (_db: Db, size = 12): IntakeLead[] => {
  return Array.from(Array(size).keys()).map((id) => {
    const status = random.arrayElement(statuses);
    const tradeType = random.arrayElement(TRADE_TYPES);
    const city = random.arrayElement(["Toronto", "Mississauga", "Brampton", "Vaughan", "Markham", "Oakville", "Hamilton", "Oshawa"]);
    const createdAt = randomDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

    const lead: IntakeLead = {
      id,
      business_name: `${company.companyName()} ${random.arrayElement(["Contracting", "Services", "Solutions", "Pro", "Inc.", "Corp."])}`,
      phone: random.arrayElement([phone.phoneNumber(), null]),
      email: random.arrayElement([internet.email(), null]),
      website: random.arrayElement([internet.url(), null]),
      address: random.arrayElement([address.streetAddress(), null]),
      city,
      region: "Ontario",
      trade_type_id: tradeType.id,
      enrichment_summary: random.arrayElement(enrichmentSamples),
      outreach_draft: random.arrayElement(outreachSamples),
      source: random.arrayElement(sources),
      status,
      rejection_reason: status === "rejected" ? random.arrayElement(rejectionReasons) : null,
      promoted_contact_id: status === "qualified" ? random.arrayElement([100, 101, 102]) : null,
      notes: random.arrayElement([lorem.sentence(), lorem.sentences(2), null, null]),
      sales_id: null,
      metadata: null,
      idempotency_key: null,
      created_at: createdAt.toISOString(),
      updated_at: createdAt.toISOString(),
    };

    return lead;
  });
};
