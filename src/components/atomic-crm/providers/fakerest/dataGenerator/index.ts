import { generateCohorts } from "./cohorts";
import { generateCompanies } from "./companies";
import { generateContactNotes } from "./contactNotes";
import { generateContacts } from "./contacts";
import { backfillDealStageEvents } from "./dealStageEvents";
import { generateDealNotes } from "./dealNotes";
import { generateDeals } from "./deals";
import { backfillEnrollmentsForWonDeals } from "./enrollments";
import { finalize } from "./finalize";
import {
  addLeifProofSliceFixtures,
  addReviewApplicationTaskFixtures,
} from "./leifProofSliceFixtures";
import { generateOffboardingRequirementTemplates } from "./offboardingRequirements";
import { generateOffers } from "./offers";
import { generateOnboardingRequirementTemplates } from "./onboardingRequirements";
import { generateSales } from "./sales";
import { backfillSalesCallsForCallLifecycleDeals } from "./salesCalls";
import { generateTags } from "./tags";
import { generateTasks } from "./tasks";
import type { Db } from "./types";
import { addWaitlistFixtures } from "./waitlistFixtures";

export default (): Db => {
  const db = {} as Db;
  db.sales = generateSales(db);
  db.tags = generateTags(db);
  db.companies = generateCompanies(db);
  db.contacts = generateContacts(db);
  db.contact_notes = generateContactNotes(db);
  const { offers, offerPaymentOptions } = generateOffers();
  db.offers = offers;
  db.offer_payment_options = offerPaymentOptions;
  db.cohorts = generateCohorts();
  db.applications = [];
  db.enrollments = [];
  db.onboarding_requirement_templates =
    generateOnboardingRequirementTemplates();
  db.enrollment_onboarding_items = [];
  db.offboarding_requirement_templates =
    generateOffboardingRequirementTemplates();
  db.enrollment_offboarding_items = [];
  db.enrollment_status_events = [];
  db.scholarship_slots = [];
  db.scholarship_slot_events = [];
  db.waitlist_entries = [];
  db.sales_calls = [];
  db.sales_call_events = [];
  db.client_sessions = [];
  db.client_session_events = [];
  db.expected_session_windows = [];
  db.enrollment_expected_sessions = [];
  db.client_session_cadence_issues = [];
  db.client_session_cadence_issue_events = [];
  db.deal_stage_events = [];
  db.deals = generateDeals(db);
  const { pendingReviewApplicants } = addLeifProofSliceFixtures(db);
  addWaitlistFixtures(db);
  backfillEnrollmentsForWonDeals(db);
  backfillSalesCallsForCallLifecycleDeals(db);
  // Every deal (random-generated and every named fixture) now has its
  // final stage_entered_at — seed the matching history row for each.
  backfillDealStageEvents(db);
  db.deal_notes = generateDealNotes(db);
  db.tasks = generateTasks(db);
  addReviewApplicationTaskFixtures(db, pendingReviewApplicants);
  db.configuration = [
    {
      id: 1,
      config: {} as Db["configuration"][number]["config"],
    },
  ];
  finalize(db);

  return db;
};
