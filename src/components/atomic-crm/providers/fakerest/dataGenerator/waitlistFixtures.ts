import type { Contact, Deal, WaitlistEntry } from "../../../types";
import type { Db } from "./types";
import { SEPTEMBER_GYU_COHORT_ID } from "./cohorts";
import { GYU_OFFER_ID, LIVING_EXAMPLE_OFFER_ID } from "./offers";

/**
 * Named, deterministic Waitlist Entry fixtures (Waitlists slice, §18).
 * Appended after addLeifProofSliceFixtures so ids are stable:
 * - Sarah Jones: Living Example, Waiting, wants the next available opening.
 * - Maya Chen: Living Example, Waiting, January preferred.
 * - Owen Blake: Living Example, Invited.
 * - Ivy Osei: Living Example, historical Converted — linked to a real
 *   Opportunity (Interested stage, matching what waitlistActions.ts'
 *   convertToOpportunity itself produces), proving the FK actually holds
 *   real history rather than an illustrative dangling reference.
 * - Felix Tran: Living Example, historical Removed.
 * - Dana Cole, Theo Marsh: Growing Yourself Up, general Offer-level
 *   Waiting (cohort_id null) — "wants GYU generally", not tied to any one
 *   cohort.
 * - Nadia Osei, Malik Rowe: September GYU Cohort, cohort-specific Waiting.
 *   Malik's entry carries a note.
 */
export const addWaitlistFixtures = (db: Db) => {
  const salesId = db.sales[0]!.id;
  const now = new Date();
  const nowIso = now.toISOString();

  const nextContactId = () => db.contacts.length;
  const nextDealId = () => db.deals.length;
  const nextWaitlistEntryId = () => db.waitlist_entries.length;

  const daysAgo = (days: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() - days);
    return date.toISOString();
  };

  const baseContact = (
    overrides: Partial<Contact> & Pick<Contact, "first_name" | "last_name">,
  ): Contact => ({
    id: nextContactId(),
    gender: "female",
    title: "",
    company_id: null,
    email_jsonb: [],
    phone_jsonb: [],
    background: "",
    avatar: {},
    first_seen: nowIso,
    last_seen: nowIso,
    has_newsletter: false,
    tags: [],
    status: "warm",
    sales_eligibility: "normal",
    linkedin_url: null,
    nb_tasks: 0,
    sales_id: salesId,
    ...overrides,
  });

  const addContact = (
    overrides: Partial<Contact> & Pick<Contact, "first_name" | "last_name">,
  ) => {
    const contact = baseContact(overrides);
    db.contacts.push(contact);
    return contact;
  };

  const addEntry = (
    overrides: Partial<WaitlistEntry> &
      Pick<WaitlistEntry, "contact_id" | "offer_id" | "status" | "joined_at">,
  ) => {
    const entry: WaitlistEntry = {
      id: nextWaitlistEntryId(),
      cohort_id: null,
      desired_timing: null,
      notes: null,
      priority: null,
      source: null,
      invited_at: null,
      converted_at: null,
      converted_opportunity_id: null,
      removed_at: null,
      created_at: nowIso,
      updated_at: nowIso,
      ...overrides,
    };
    db.waitlist_entries.push(entry);
    return entry;
  };

  // --- Living Example: Sarah Jones, Waiting ------------------------------
  const sarah = addContact({
    first_name: "Sarah",
    last_name: "Jones",
    email_jsonb: [{ email: "sarah.jones@example.com", type: "Home" }],
    background: "Wants The Living Example when a spot opens up.",
  });
  addEntry({
    contact_id: sarah.id,
    offer_id: LIVING_EXAMPLE_OFFER_ID,
    status: "waiting",
    joined_at: daysAgo(17),
    desired_timing: "Wants next available opening",
    source: "instagram",
  });

  // --- Living Example: Maya Chen, Waiting --------------------------------
  const maya = addContact({
    first_name: "Maya",
    last_name: "Chen",
    email_jsonb: [{ email: "maya.chen@example.com", type: "Home" }],
    background: "Interested in The Living Example, flexible on start date.",
  });
  addEntry({
    contact_id: maya.id,
    offer_id: LIVING_EXAMPLE_OFFER_ID,
    status: "waiting",
    joined_at: daysAgo(13),
    desired_timing: "January preferred",
    source: "referral",
  });

  // --- Living Example: Owen Blake, Invited -------------------------------
  const owen = addContact({
    first_name: "Owen",
    last_name: "Blake",
    gender: "male",
    email_jsonb: [{ email: "owen.blake@example.com", type: "Home" }],
    background: "Offered the next Living Example opening.",
  });
  addEntry({
    contact_id: owen.id,
    offer_id: LIVING_EXAMPLE_OFFER_ID,
    status: "invited",
    joined_at: daysAgo(24),
    invited_at: daysAgo(2),
    source: "workshop",
  });

  // --- Living Example: Ivy Osei, historical Converted --------------------
  // Real linked Opportunity at "Interested" — exactly what
  // waitlistActions.ts' convertToOpportunity itself would have produced,
  // so this fixture proves the FK holds real, consistent history.
  const ivy = addContact({
    first_name: "Ivy",
    last_name: "Osei",
    email_jsonb: [{ email: "ivy.osei@example.com", type: "Home" }],
    background: "Converted from the Living Example waitlist.",
  });
  const ivyOpportunity: Deal = {
    id: nextDealId(),
    name: "Ivy Osei — The Living Example",
    contact_id: ivy.id,
    offer_id: LIVING_EXAMPLE_OFFER_ID,
    offer_name_snapshot: "The Living Example",
    offer_price_snapshot: 4000,
    stage: "interested",
    outcome: null,
    amount: 4000,
    source: "podcast",
    description: "Acceptance-test fixture: converted from the LE waitlist.",
    created_at: daysAgo(5),
    updated_at: daysAgo(5),
    expected_closing_date: daysAgo(5).split("T")[0],
    sales_id: salesId,
    index: 0,
    stage_entered_at: daysAgo(5),
  };
  db.deals.push(ivyOpportunity);
  addEntry({
    contact_id: ivy.id,
    offer_id: LIVING_EXAMPLE_OFFER_ID,
    status: "converted",
    joined_at: daysAgo(30),
    source: "podcast",
    converted_at: daysAgo(5),
    converted_opportunity_id: ivyOpportunity.id,
  });

  // --- Living Example: Felix Tran, historical Removed --------------------
  const felixTran = addContact({
    first_name: "Felix",
    last_name: "Tran",
    gender: "male",
    email_jsonb: [{ email: "felix.tran@example.com", type: "Home" }],
    background: "No longer interested in the Living Example waitlist.",
  });
  addEntry({
    contact_id: felixTran.id,
    offer_id: LIVING_EXAMPLE_OFFER_ID,
    status: "removed",
    joined_at: daysAgo(40),
    removed_at: daysAgo(20),
  });

  // --- Growing Yourself Up: general Offer-level Waiting ------------------
  const dana = addContact({
    first_name: "Dana",
    last_name: "Cole",
    email_jsonb: [{ email: "dana.cole@example.com", type: "Home" }],
    background: "Wants Growing Yourself Up generally, no cohort preference.",
  });
  addEntry({
    contact_id: dana.id,
    offer_id: GYU_OFFER_ID,
    status: "waiting",
    joined_at: daysAgo(9),
    desired_timing: "Next available cohort",
  });

  const theo = addContact({
    first_name: "Theo",
    last_name: "Marsh",
    gender: "male",
    email_jsonb: [{ email: "theo.marsh@example.com", type: "Home" }],
    background: "Interested in Growing Yourself Up, timing flexible.",
  });
  addEntry({
    contact_id: theo.id,
    offer_id: GYU_OFFER_ID,
    status: "waiting",
    joined_at: daysAgo(6),
  });

  // --- Growing Yourself Up: September Cohort, cohort-specific Waiting ----
  const nadia = addContact({
    first_name: "Nadia",
    last_name: "Osei",
    email_jsonb: [{ email: "nadia.osei@example.com", type: "Home" }],
    background: "Specifically wants the September GYU cohort.",
  });
  addEntry({
    contact_id: nadia.id,
    offer_id: GYU_OFFER_ID,
    cohort_id: SEPTEMBER_GYU_COHORT_ID,
    status: "waiting",
    joined_at: daysAgo(11),
  });

  const malik = addContact({
    first_name: "Malik",
    last_name: "Rowe",
    gender: "male",
    email_jsonb: [{ email: "malik.rowe@example.com", type: "Home" }],
    background: "Specifically wants the September GYU cohort.",
  });
  addEntry({
    contact_id: malik.id,
    offer_id: GYU_OFFER_ID,
    cohort_id: SEPTEMBER_GYU_COHORT_ID,
    status: "waiting",
    joined_at: daysAgo(4),
    notes: "Prefers weekday evening sessions; already spoke with Leif once.",
  });

  // November (NOVEMBER_GYU_COHORT_ID) stays deliberately untouched by
  // fixtures — proves the Cohort page's Waitlist section shows a real,
  // sensible empty state rather than silently inheriting September's or
  // GYU's general entries (§8: "Do not place general Offer-level GYU
  // waitlist people into September automatically").
};
