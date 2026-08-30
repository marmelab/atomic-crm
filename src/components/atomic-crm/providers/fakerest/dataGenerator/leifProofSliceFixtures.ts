import { LIVING_EXAMPLE_OFFER } from "../../../deals/opportunityConstants";
import type { Contact, Deal } from "../../../types";
import type { Db } from "./types";

/**
 * Named, deterministic acceptance-test fixtures for the Opportunity pipeline
 * proof slice (fake/demo data only — not real client data). Appended after
 * the random generators so their ids are stable and easy to find:
 * - Judy: an active opportunity, visible on the Kanban board.
 * - Marcus: an opportunity already Won, to show it leaving the active board
 *   while staying visible on his Contact page.
 */
export const addLeifProofSliceFixtures = (db: Db) => {
  const salesId = db.sales[0]!.id;
  const now = new Date().toISOString();

  const judy: Contact = {
    id: db.contacts.length,
    first_name: "Judy",
    last_name: "Holloway",
    gender: "female",
    title: "",
    company_id: null,
    email_jsonb: [{ email: "judy.holloway@example.com", type: "Home" }],
    phone_jsonb: [],
    background: "Found the CRM via Instagram; ready for a call.",
    avatar: {},
    first_seen: now,
    last_seen: now,
    has_newsletter: false,
    tags: [],
    status: "warm",
    linkedin_url: null,
    nb_tasks: 0,
    sales_id: salesId,
  };
  db.contacts.push(judy);

  const judyOpportunity: Deal = {
    id: db.deals.length,
    name: "Judy Holloway — The Living Example",
    contact_id: judy.id,
    offer: LIVING_EXAMPLE_OFFER,
    stage: "call_booked",
    source: "instagram",
    entry_path: "instagram_conversation",
    description: "Acceptance-test fixture: active opportunity for Judy.",
    amount: 4000,
    created_at: now,
    updated_at: now,
    expected_closing_date: now.split("T")[0],
    sales_id: salesId,
    index: 0,
  };
  db.deals.push(judyOpportunity);

  const marcus: Contact = {
    id: db.contacts.length,
    first_name: "Marcus",
    last_name: "Bennett",
    gender: "male",
    title: "",
    company_id: null,
    email_jsonb: [{ email: "marcus.bennett@example.com", type: "Home" }],
    phone_jsonb: [],
    background: "Signed up after a workshop.",
    avatar: {},
    first_seen: now,
    last_seen: now,
    has_newsletter: false,
    tags: [],
    status: "in-contract",
    linkedin_url: null,
    nb_tasks: 0,
    sales_id: salesId,
  };
  db.contacts.push(marcus);

  const marcusOpportunity: Deal = {
    id: db.deals.length,
    name: "Marcus Bennett — The Living Example",
    contact_id: marcus.id,
    offer: LIVING_EXAMPLE_OFFER,
    stage: "won",
    owner_decision: "would_work_with",
    prospect_decision: "yes",
    source: "workshop",
    entry_path: "sales_page",
    description:
      "Acceptance-test fixture: Won, so it should be off the active board but still visible on Marcus's Contact page.",
    amount: 4000,
    created_at: now,
    updated_at: now,
    expected_closing_date: now.split("T")[0],
    sales_id: salesId,
    index: 0,
  };
  db.deals.push(marcusOpportunity);
};
