import type {
  Application,
  Contact,
  Deal,
  Enrollment,
  SalesCall,
  SalesCallEvent,
} from "../../../types";
import type { Db } from "./types";
import { SEPTEMBER_GYU_COHORT_ID } from "./cohorts";
import { GYU_OFFER_ID, LIVING_EXAMPLE_OFFER_ID } from "./offers";

/**
 * Named, deterministic acceptance-test fixtures for the Opportunity pipeline
 * and Offer/Cohort/Application/Enrollment domain model (fake/demo data
 * only — not real client data). Appended after the random generators so
 * their ids are stable and easy to find:
 * - Judy: an active Living Example opportunity, visible on the Kanban board,
 *   at Call Booked with a real sales_calls record behind it (Human-
 *   acceptance repair pass, §Repair 2) — proves Complete Sales Call is
 *   immediately available rather than falling into the legacy/
 *   inconsistent-record recovery state.
 * - Marcus: a Living Example opportunity already Won, with an active
 *   Enrollment, to show it leaving the active board while staying visible
 *   on his Contact page.
 * - Priya: a GYU applicant in the September cohort, application pending.
 * - Sam: a GYU participant enrolled in the September cohort.
 * - Alex: a GYU opportunity still in sales for the September cohort
 *   (approved application, not yet Won).
 * - Jordan: a GYU applicant who exited (application rejected).
 * - Chris: a RETURNING client — completed a Growing Yourself Up cohort in
 *   the past (Enrollment status "completed"), no open Opportunity right
 *   now. Exists so the Opportunity "Person" field's search can be tested
 *   against a real past client (Programs + Opportunity UX slice, §2/§14):
 *   searching "Chr" should surface Chris with a "Past ... client" context
 *   label, and selecting them for a new Opportunity must reuse this same
 *   Contact rather than creating a second "Chris".
 * - Kathy, Dave, Julia: active Living Example clients with real future
 *   Enrollment end dates, staggered so Dave and Julia share the same date
 *   (two openings on one day) while Kathy's is sooner (§9/§14).
 * - Nora: a COMPLETED Living Example Enrollment in the past — must never
 *   appear as a future opening (§9/§14).
 * - Rosalind: a 1:1 (Living Example) applicant, application pending — the
 *   only individual-offer Application fixture, so the Applications page's
 *   "1:1 — The Living Example" section has something real to show next to
 *   Growing Yourself Up's (Runtime + Visual Consistency slice, §5).
 * - Naomi: a 1:1 applicant already Approved — proves the Approved outcome's
 *   Application/Opportunity sync in fixture data (Native Applications
 *   slice, §4/§15).
 * - Felix: a GYU applicant reviewed as Needs Higher Care — proves the
 *   Opportunity exits the active pipeline via `outcome` alone, stage left
 *   untouched (§5/§15).
 * - Portia: a GYU applicant reviewed as Do Not Engage — proves the
 *   Contact-level sales_eligibility gate end-to-end (§7/§15).
 *
 * Priya and Rosalind (both still pending) also get a deterministic "Review
 * Application" Task each — see addReviewApplicationTaskFixtures below,
 * called separately after the random Task generator runs so ids never
 * collide (§8/§15).
 */
export const addLeifProofSliceFixtures = (db: Db) => {
  const salesId = db.sales[0]!.id;
  const now = new Date().toISOString();

  const nextContactId = () => db.contacts.length;
  const nextDealId = () => db.deals.length;
  const nextApplicationId = () => db.applications.length;
  const nextEnrollmentId = () => db.enrollments.length;
  const nextSalesCallId = () => db.sales_calls.length;
  const nextSalesCallEventId = () => db.sales_call_events.length;

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
    first_seen: now,
    last_seen: now,
    has_newsletter: false,
    tags: [],
    status: "warm",
    sales_eligibility: "normal",
    linkedin_url: null,
    nb_tasks: 0,
    sales_id: salesId,
    ...overrides,
  });

  const baseDeal = (
    overrides: Partial<Deal> &
      Pick<Deal, "name" | "contact_id" | "offer_id" | "stage">,
  ): Deal => ({
    pricing_mode: "standard",
    id: nextDealId(),
    description: "",
    amount: 4000,
    created_at: now,
    updated_at: now,
    expected_closing_date: now.split("T")[0],
    sales_id: salesId,
    index: 0,
    // Placeholder — every fixture Opportunity below gets a real, staggered
    // value at the end of this function (see the Kanban queue-ordering
    // pass below `return`), so several fixtures sharing one stage (e.g.
    // the five "application_received" applicants) never tie.
    stage_entered_at: now,
    ...overrides,
  });

  // Kanban queue-ordering slice: every deal pushed below this point gets a
  // staggered stage_entered_at (see the loop just before `return`) — real
  // per-row variety instead of every named fixture sharing the identical
  // `now`, which would leave same-stage deals (e.g. the five
  // application_received applicants) with no meaningful sort order.
  const firstStaggeredDealId = nextDealId();

  // --- Judy: active Living Example opportunity ---------------------------
  const judy = baseContact({
    first_name: "Judy",
    last_name: "Holloway",
    email_jsonb: [{ email: "judy.holloway@example.com", type: "Home" }],
    background: "Found the CRM via Instagram; ready for a call.",
  });
  db.contacts.push(judy);

  // A Call Booked Opportunity needs a real sales_calls record behind it —
  // Judy is the fixture proving that (Human-acceptance repair pass,
  // §Repair 2: a Call Booked Opportunity with no Sales Call record is
  // exactly the "legacy/inconsistent" state DealSalesCallSection.tsx
  // must recover from gracefully, never reach in fixture data).
  const judySalesCallScheduledAt = new Date(now);
  judySalesCallScheduledAt.setDate(judySalesCallScheduledAt.getDate() + 3);

  const judyOpportunity = baseDeal({
    name: "Judy Holloway — The Living Example",
    contact_id: judy.id,
    offer_id: LIVING_EXAMPLE_OFFER_ID,
    offer_name_snapshot: "The Living Example",
    offer_price_snapshot: 4000,
    stage: "call_booked",
    sales_call_at: judySalesCallScheduledAt.toISOString(),
    source: "instagram",
    entry_path: "instagram_conversation",
    description: "Acceptance-test fixture: active opportunity for Judy.",
  });
  db.deals.push(judyOpportunity);

  const judySalesCall: SalesCall = {
    id: nextSalesCallId(),
    opportunity_id: judyOpportunity.id,
    contact_id: judy.id,
    status: "booked",
    original_scheduled_at: judySalesCallScheduledAt.toISOString(),
    scheduled_at: judySalesCallScheduledAt.toISOString(),
    reschedule_count: 0,
    source: "manual",
    created_at: now,
    updated_at: now,
  };
  db.sales_calls.push(judySalesCall);

  const judySalesCallEvent: SalesCallEvent = {
    id: nextSalesCallEventId(),
    sales_call_id: judySalesCall.id,
    kind: "booked",
    occurred_at: now,
    new_scheduled_at: judySalesCallScheduledAt.toISOString(),
    created_at: now,
  };
  db.sales_call_events.push(judySalesCallEvent);

  // --- Marcus: Won Living Example opportunity, with an Enrollment --------
  const marcus = baseContact({
    first_name: "Marcus",
    last_name: "Bennett",
    gender: "male",
    email_jsonb: [{ email: "marcus.bennett@example.com", type: "Home" }],
    background: "Signed up after a workshop.",
    status: "in-contract",
  });
  db.contacts.push(marcus);

  const marcusOpportunity = baseDeal({
    name: "Marcus Bennett — The Living Example",
    contact_id: marcus.id,
    offer_id: LIVING_EXAMPLE_OFFER_ID,
    offer_name_snapshot: "The Living Example",
    offer_price_snapshot: 4000,
    stage: "won",
    owner_decision: "would_work_with",
    prospect_decision: "yes",
    source: "workshop",
    entry_path: "sales_page",
    description:
      "Acceptance-test fixture: Won, so it should be off the active board but still visible on Marcus's Contact page.",
  });
  db.deals.push(marcusOpportunity);

  // Living Example has no Cohort to derive dates from — a 4-month
  // individual enrollment needs explicit start/end dates (see
  // types.ts / handle_deal_won()).
  const marcusStart = new Date(now);
  const marcusEnd = new Date(marcusStart);
  marcusEnd.setMonth(marcusEnd.getMonth() + 4);
  const marcusEnrollment: Enrollment = {
    id: nextEnrollmentId(),
    opportunity_id: marcusOpportunity.id,
    status: "active",
    start_date: marcusStart.toISOString().split("T")[0],
    end_date: marcusEnd.toISOString().split("T")[0],
    created_at: now,
    updated_at: now,
  };
  db.enrollments.push(marcusEnrollment);

  // --- Priya: GYU applicant, September cohort, application pending -------
  const priya = baseContact({
    first_name: "Priya",
    last_name: "Nair",
    email_jsonb: [{ email: "priya.nair@example.com", type: "Home" }],
    background: "Applied for the September Growing Yourself Up cohort.",
  });
  db.contacts.push(priya);

  const priyaOpportunity = baseDeal({
    name: "Priya Nair — Growing Yourself Up",
    contact_id: priya.id,
    offer_id: GYU_OFFER_ID,
    offer_name_snapshot: "Growing Yourself Up",
    offer_price_snapshot: 1400,
    cohort_id: SEPTEMBER_GYU_COHORT_ID,
    stage: "application_received",
    amount: 1400,
    source: "podcast",
    entry_path: "sales_page",
    description: "Acceptance-test fixture: GYU applicant awaiting review.",
  });
  db.deals.push(priyaOpportunity);

  const priyaApplication: Application = {
    id: nextApplicationId(),
    opportunity_id: priyaOpportunity.id,
    status: "pending",
    submitted_at: now,
    reviewed_at: null,
    raw_answers: {
      why_this_cohort: "I want structured support building healthier habits.",
      availability: "Weekday evenings",
    },
    summary: null,
    created_at: now,
    updated_at: now,
  };
  db.applications.push(priyaApplication);

  // --- Alex: GYU opportunity still in sales (approved, not yet Won) ------
  const alex = baseContact({
    first_name: "Alex",
    last_name: "Rivera",
    gender: "male",
    email_jsonb: [{ email: "alex.rivera@example.com", type: "Home" }],
    background: "Approved for September GYU; deciding on payment plan.",
  });
  db.contacts.push(alex);

  const alexOpportunity = baseDeal({
    name: "Alex Rivera — Growing Yourself Up",
    contact_id: alex.id,
    offer_id: GYU_OFFER_ID,
    offer_name_snapshot: "Growing Yourself Up",
    offer_price_snapshot: 1400,
    cohort_id: SEPTEMBER_GYU_COHORT_ID,
    stage: "decision",
    owner_decision: "would_work_with",
    prospect_decision: "thinking",
    follow_up_date: now.split("T")[0],
    amount: 1400,
    source: "referral",
    entry_path: "other",
    description: "Acceptance-test fixture: approved, still in sales.",
  });
  db.deals.push(alexOpportunity);

  db.applications.push({
    id: nextApplicationId(),
    opportunity_id: alexOpportunity.id,
    status: "approved",
    submitted_at: now,
    reviewed_at: now,
    raw_answers: {
      why_this_cohort: "A friend recommended it after their own cohort.",
      availability: "Weekend mornings",
    },
    summary: "Qualified; deciding between payment plans.",
    created_at: now,
    updated_at: now,
  });

  // --- Sam: GYU participant enrolled in the September cohort -------------
  const sam = baseContact({
    first_name: "Sam",
    last_name: "Okafor",
    gender: "male",
    email_jsonb: [{ email: "sam.okafor@example.com", type: "Home" }],
    background: "Enrolled in the September Growing Yourself Up cohort.",
    status: "in-contract",
  });
  db.contacts.push(sam);

  const samOpportunity = baseDeal({
    name: "Sam Okafor — Growing Yourself Up",
    contact_id: sam.id,
    offer_id: GYU_OFFER_ID,
    offer_name_snapshot: "Growing Yourself Up",
    offer_price_snapshot: 1400,
    cohort_id: SEPTEMBER_GYU_COHORT_ID,
    stage: "won",
    owner_decision: "would_work_with",
    prospect_decision: "yes",
    amount: 1400,
    source: "google",
    entry_path: "sales_page",
    description: "Acceptance-test fixture: enrolled GYU participant.",
  });
  db.deals.push(samOpportunity);

  db.applications.push({
    id: nextApplicationId(),
    opportunity_id: samOpportunity.id,
    status: "approved",
    submitted_at: now,
    reviewed_at: now,
    raw_answers: {
      why_this_cohort: "Ready to commit to the full 8 weeks.",
      availability: "Flexible",
    },
    summary: "Strong fit; approved and enrolled.",
    created_at: now,
    updated_at: now,
  });

  const september = db.cohorts.find((c) => c.id === SEPTEMBER_GYU_COHORT_ID);
  db.enrollments.push({
    id: nextEnrollmentId(),
    opportunity_id: samOpportunity.id,
    status: "active",
    start_date: september?.program_start_at?.split("T")[0] ?? null,
    end_date: september?.program_end_at?.split("T")[0] ?? null,
    created_at: now,
    updated_at: now,
  });

  // --- Jordan: GYU applicant who exited (application rejected) -----------
  const jordan = baseContact({
    first_name: "Jordan",
    last_name: "Lee",
    gender: "male",
    email_jsonb: [{ email: "jordan.lee@example.com", type: "Home" }],
    background: "Applied for September GYU; not a fit at this time.",
    status: "cold",
  });
  db.contacts.push(jordan);

  const jordanOpportunity = baseDeal({
    name: "Jordan Lee — Growing Yourself Up",
    contact_id: jordan.id,
    offer_id: GYU_OFFER_ID,
    offer_name_snapshot: "Growing Yourself Up",
    offer_price_snapshot: 1400,
    cohort_id: SEPTEMBER_GYU_COHORT_ID,
    stage: "application_received",
    outcome: "not_fit",
    amount: 1400,
    source: "instagram",
    entry_path: "instagram_conversation",
    description: "Acceptance-test fixture: application reviewed, Not Fit.",
  });
  db.deals.push(jordanOpportunity);

  db.applications.push({
    id: nextApplicationId(),
    opportunity_id: jordanOpportunity.id,
    status: "not_fit",
    submitted_at: now,
    reviewed_at: now,
    raw_answers: {
      why_this_cohort: "Curious about the program.",
      availability: "Not yet sure",
    },
    summary: "Not ready for a group cohort at this time.",
    created_at: now,
    updated_at: now,
  });

  // --- Chris: RETURNING client, completed GYU in the past -----------------
  const chris = baseContact({
    first_name: "Chris",
    last_name: "Smith",
    gender: "male",
    email_jsonb: [{ email: "chris.smith@example.com", type: "Home" }],
    background: "Completed Growing Yourself Up; no open opportunity today.",
    status: "cold",
  });
  db.contacts.push(chris);

  const chrisPastStart = new Date(now);
  chrisPastStart.setMonth(chrisPastStart.getMonth() - 4);
  const chrisPastEnd = new Date(now);
  chrisPastEnd.setMonth(chrisPastEnd.getMonth() - 2);
  const chrisOpportunity = baseDeal({
    name: "Chris Smith — Growing Yourself Up",
    contact_id: chris.id,
    offer_id: GYU_OFFER_ID,
    offer_name_snapshot: "Growing Yourself Up",
    offer_price_snapshot: 1400,
    stage: "won",
    owner_decision: "would_work_with",
    prospect_decision: "yes",
    amount: 1400,
    source: "referral",
    entry_path: "sales_page",
    description:
      "Acceptance-test fixture: past client, completed. See §2/§14 of the Programs + Opportunity UX slice.",
  });
  db.deals.push(chrisOpportunity);

  db.enrollments.push({
    id: nextEnrollmentId(),
    opportunity_id: chrisOpportunity.id,
    status: "completed",
    start_date: chrisPastStart.toISOString().split("T")[0],
    end_date: chrisPastEnd.toISOString().split("T")[0],
    created_at: now,
    updated_at: now,
  });

  // --- Kathy, Dave, Julia: active Living Example clients with real ---------
  // future end dates (Dave and Julia share a date — two openings, one day).
  const soon = new Date(now);
  soon.setMonth(soon.getMonth() + 2);
  const soonDate = soon.toISOString().split("T")[0];

  const later = new Date(now);
  later.setMonth(later.getMonth() + 3);
  const laterDate = later.toISOString().split("T")[0];

  const pastStart = new Date(now);
  pastStart.setMonth(pastStart.getMonth() - 2);
  const pastStartDate = pastStart.toISOString().split("T")[0];

  const addActiveLivingExampleClient = (contact: Contact, endDate: string) => {
    db.contacts.push(contact);
    const opportunity = baseDeal({
      name: `${contact.first_name} ${contact.last_name} — The Living Example`,
      contact_id: contact.id,
      offer_id: LIVING_EXAMPLE_OFFER_ID,
      offer_name_snapshot: "The Living Example",
      offer_price_snapshot: 4000,
      stage: "won",
      owner_decision: "would_work_with",
      prospect_decision: "yes",
      amount: 4000,
      source: "referral",
      entry_path: "sales_page",
      description: "Acceptance-test fixture: active Living Example client.",
    });
    db.deals.push(opportunity);
    db.enrollments.push({
      id: nextEnrollmentId(),
      opportunity_id: opportunity.id,
      status: "active",
      start_date: pastStartDate,
      end_date: endDate,
      created_at: now,
      updated_at: now,
    });
  };

  addActiveLivingExampleClient(
    baseContact({
      first_name: "Kathy",
      last_name: "Reyes",
      email_jsonb: [{ email: "kathy.reyes@example.com", type: "Home" }],
      background: "Living Example client, completing soon.",
      status: "in-contract",
    }),
    soonDate,
  );
  addActiveLivingExampleClient(
    baseContact({
      first_name: "Dave",
      last_name: "Kim",
      gender: "male",
      email_jsonb: [{ email: "dave.kim@example.com", type: "Home" }],
      background: "Living Example client.",
      status: "in-contract",
    }),
    laterDate,
  );
  addActiveLivingExampleClient(
    baseContact({
      first_name: "Julia",
      last_name: "Chen",
      email_jsonb: [{ email: "julia.chen@example.com", type: "Home" }],
      background: "Living Example client, same completion date as Dave.",
      status: "in-contract",
    }),
    laterDate,
  );

  // --- Nora: COMPLETED Living Example Enrollment (must not free a slot) ---
  const nora = baseContact({
    first_name: "Nora",
    last_name: "Whitfield",
    email_jsonb: [{ email: "nora.whitfield@example.com", type: "Home" }],
    background: "Completed the Living Example already.",
    status: "cold",
  });
  db.contacts.push(nora);

  const noraStart = new Date(now);
  noraStart.setMonth(noraStart.getMonth() - 6);
  const noraEnd = new Date(now);
  noraEnd.setMonth(noraEnd.getMonth() - 2);
  const noraOpportunity = baseDeal({
    name: "Nora Whitfield — The Living Example",
    contact_id: nora.id,
    offer_id: LIVING_EXAMPLE_OFFER_ID,
    offer_name_snapshot: "The Living Example",
    offer_price_snapshot: 4000,
    stage: "won",
    owner_decision: "would_work_with",
    prospect_decision: "yes",
    amount: 4000,
    source: "referral",
    entry_path: "sales_page",
    description:
      "Acceptance-test fixture: completed — must never appear as an upcoming opening (§9/§14).",
  });
  db.deals.push(noraOpportunity);

  db.enrollments.push({
    id: nextEnrollmentId(),
    opportunity_id: noraOpportunity.id,
    status: "completed",
    start_date: noraStart.toISOString().split("T")[0],
    end_date: noraEnd.toISOString().split("T")[0],
    created_at: now,
    updated_at: now,
  });

  // --- Rosalind: 1:1 (Living Example) applicant, application pending ------
  const rosalind = baseContact({
    first_name: "Rosalind",
    last_name: "Park",
    email_jsonb: [{ email: "rosalind.park@example.com", type: "Home" }],
    background: "Applied for The Living Example.",
  });
  db.contacts.push(rosalind);

  const rosalindOpportunity = baseDeal({
    name: "Rosalind Park — The Living Example",
    contact_id: rosalind.id,
    offer_id: LIVING_EXAMPLE_OFFER_ID,
    offer_name_snapshot: "The Living Example",
    offer_price_snapshot: 4000,
    stage: "application_received",
    amount: 4000,
    source: "instagram",
    entry_path: "instagram_conversation",
    description:
      "Acceptance-test fixture: 1:1 applicant, so Applications separates 1:1 from Growing Yourself Up (§5/§14).",
  });
  db.deals.push(rosalindOpportunity);

  db.applications.push({
    id: nextApplicationId(),
    opportunity_id: rosalindOpportunity.id,
    status: "pending",
    submitted_at: now,
    reviewed_at: null,
    raw_answers: {
      why_this_program: "Ready for consistent 1:1 support.",
      availability: "Weekday mornings",
    },
    summary: null,
    created_at: now,
    updated_at: now,
  });

  // --- Naomi: 1:1 (Living Example) applicant, already Approved -----------
  // Proves the Approved outcome end-to-end in fixture data: stage moved to
  // 'approved', outcome stays null, Application.status/reviewed_at are set
  // — exactly what reviewApplication.ts itself writes (Native Applications
  // slice, §4/§15).
  const naomi = baseContact({
    first_name: "Naomi",
    last_name: "Ellison",
    email_jsonb: [{ email: "naomi.ellison@example.com", type: "Home" }],
    background: "Applied for The Living Example; approved for a sales call.",
  });
  db.contacts.push(naomi);

  const naomiOpportunity = baseDeal({
    name: "Naomi Ellison — The Living Example",
    contact_id: naomi.id,
    offer_id: LIVING_EXAMPLE_OFFER_ID,
    offer_name_snapshot: "The Living Example",
    offer_price_snapshot: 4000,
    stage: "approved",
    outcome: null,
    amount: 4000,
    source: "other",
    entry_path: "sales_page",
    description:
      "Acceptance-test fixture: 1:1 applicant already Approved (§4/§15).",
  });
  db.deals.push(naomiOpportunity);

  db.applications.push({
    id: nextApplicationId(),
    opportunity_id: naomiOpportunity.id,
    status: "approved",
    submitted_at: now,
    reviewed_at: now,
    raw_answers: {
      why_this_program: "Ready to commit to consistent 1:1 coaching.",
      availability: "Weekday afternoons",
    },
    summary: "Strong fit; approved for a sales call.",
    created_at: now,
    updated_at: now,
  });

  // --- Felix: GYU applicant reviewed as Needs Higher Care -----------------
  // Proves the Opportunity exits the active pipeline via `outcome` alone
  // (stage is deliberately left untouched, matching reviewApplication.ts —
  // §5/§15) while the Contact stays fully eligible for future contact.
  const felix = baseContact({
    first_name: "Felix",
    last_name: "Adeyemi",
    gender: "male",
    email_jsonb: [{ email: "felix.adeyemi@example.com", type: "Home" }],
    background:
      "Applied for September GYU; reviewed as needing more support first.",
  });
  db.contacts.push(felix);

  const felixOpportunity = baseDeal({
    name: "Felix Adeyemi — Growing Yourself Up",
    contact_id: felix.id,
    offer_id: GYU_OFFER_ID,
    offer_name_snapshot: "Growing Yourself Up",
    offer_price_snapshot: 1400,
    cohort_id: SEPTEMBER_GYU_COHORT_ID,
    stage: "application_received",
    outcome: "needs_higher_care",
    amount: 1400,
    source: "workshop",
    entry_path: "other",
    description:
      "Acceptance-test fixture: reviewed as Needs Higher Care (§5/§15).",
  });
  db.deals.push(felixOpportunity);

  db.applications.push({
    id: nextApplicationId(),
    opportunity_id: felixOpportunity.id,
    status: "needs_higher_care",
    submitted_at: now,
    reviewed_at: now,
    raw_answers: {
      why_this_cohort: "Saw it mentioned at a workshop and got curious.",
      availability: "Weekday evenings",
    },
    summary:
      "Some concerning signals in the answers; needs a higher-care check-in before any group cohort.",
    created_at: now,
    updated_at: now,
  });

  // --- Portia: GYU applicant reviewed as Do Not Engage --------------------
  // Proves the Contact-level Sales Eligibility gate end-to-end: the
  // Opportunity exits (outcome 'lost' + owner_decision 'do_not_engage',
  // reusing existing Opportunity architecture — §7) and the Contact itself
  // is marked do_not_engage, independent of any single Opportunity.
  const portia = baseContact({
    first_name: "Portia",
    last_name: "Vance",
    email_jsonb: [{ email: "portia.vance@example.com", type: "Home" }],
    background: "Applied for September GYU; reviewed as Do Not Engage.",
    sales_eligibility: "do_not_engage",
  });
  db.contacts.push(portia);

  const portiaOpportunity = baseDeal({
    name: "Portia Vance — Growing Yourself Up",
    contact_id: portia.id,
    offer_id: GYU_OFFER_ID,
    offer_name_snapshot: "Growing Yourself Up",
    offer_price_snapshot: 1400,
    cohort_id: SEPTEMBER_GYU_COHORT_ID,
    stage: "application_received",
    outcome: "lost",
    owner_decision: "do_not_engage",
    amount: 1400,
    source: "instagram",
    entry_path: "instagram_conversation",
    description: "Acceptance-test fixture: reviewed as Do Not Engage (§7/§15).",
  });
  db.deals.push(portiaOpportunity);

  db.applications.push({
    id: nextApplicationId(),
    opportunity_id: portiaOpportunity.id,
    status: "do_not_engage",
    submitted_at: now,
    reviewed_at: now,
    raw_answers: {
      why_this_cohort: "N/A",
      availability: "N/A",
    },
    summary: "Do not engage — see review notes.",
    created_at: now,
    updated_at: now,
  });

  // Kanban queue-ordering slice: give every fixture Opportunity pushed
  // above a distinct stage_entered_at, oldest-declared first, one hour
  // apart, all safely in the past. Real values (never fabricated as more
  // precise than "roughly when this fixture was written"), but no two
  // deals — including the five that share application_received — ever
  // tie, so the Kanban's oldest-first sort has real fixture data to prove
  // itself against. Immutability: replaces each array slot with a new
  // object rather than mutating the one baseDeal() returned.
  for (let id = firstStaggeredDealId; id < db.deals.length; id += 1) {
    const hoursAgo = db.deals.length - id;
    const staggered = new Date(
      new Date(now).getTime() - hoursAgo * 60 * 60 * 1000,
    ).toISOString();
    db.deals[id] = { ...db.deals[id], stage_entered_at: staggered };
  }

  // Contacts with a pending Application still needing their "Review
  // Application" task — created after generateTasks() runs (see index.ts)
  // so the deterministic task ids never collide with the random generator's
  // 0..399 range (§8/§15).
  return {
    pendingReviewApplicants: [
      { contactId: priya.id, applicantName: "Priya Nair" },
      { contactId: rosalind.id, applicantName: "Rosalind Park" },
    ],
  };
};

// Called from index.ts after db.tasks = generateTasks(db), so these
// deterministic ids continue the sequence rather than colliding with the
// random generator's 0..399 (Native Applications slice, §8): one pending
// "Review Application" task per still-pending Application fixture, proving
// the Task <-> Application linkage the review actions rely on.
export const addReviewApplicationTaskFixtures = (
  db: Db,
  pendingReviewApplicants: {
    contactId: Contact["id"];
    applicantName: string;
  }[],
) => {
  const salesId = db.sales[0]!.id;
  const now = new Date().toISOString();
  const nextTaskId = () => db.tasks.length;

  for (const { contactId, applicantName } of pendingReviewApplicants) {
    db.tasks.push({
      id: nextTaskId(),
      contact_id: contactId,
      type: "review_application",
      text: `Review ${applicantName}'s application`,
      due_date: now,
      done_date: undefined,
      status: "pending",
      sales_id: salesId,
    });

    // Mirrors generateTasks()'s own inline nb_tasks bump (this denormalized
    // counter is otherwise only kept in sync at task-generation time).
    const contact = db.contacts.find((c) => c.id === contactId);
    if (contact) {
      contact.nb_tasks = (contact.nb_tasks ?? 0) + 1;
    }
  }
};
