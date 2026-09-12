import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest/dataProvider";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import type {
  Application,
  Cohort,
  Contact,
  Deal,
  Offer,
  Task,
  WaitlistEntry,
} from "../types";
import { submitApplication } from "./submitApplication";

const LE_OFFER_ID = 1;
const GYU_OFFER_ID = 2;
const COHORT_ID = 1;
const CONTACT_ID = 1;

const livingExample: Offer = {
  id: LE_OFFER_ID,
  name: "The Living Example",
  type: "individual",
  duration: "4 months",
  current_price: 4000,
  max_active_clients: 5,
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const growingYourselfUp: Offer = {
  id: GYU_OFFER_ID,
  name: "Growing Yourself Up",
  type: "group",
  duration: "8 weeks",
  current_price: 1400,
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const buildCohort = (overrides: Partial<Cohort> = {}): Cohort => ({
  id: COHORT_ID,
  offer_id: GYU_OFFER_ID,
  name: "September Cohort",
  status: "applications_open",
  applications_open_at: "2026-08-01",
  applications_close_at: "2026-09-30",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const buildFixtures = (
  overrides: {
    contacts?: Parameters<typeof buildContact>[0][];
    cohorts?: Cohort[];
    deals?: Deal[];
    applications?: Application[];
    tasks?: Task[];
    waitlist_entries?: WaitlistEntry[];
  } = {},
) => {
  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: overrides.contacts?.map((c) => buildContact(c)) ?? [],
      offers: [livingExample, growingYourselfUp],
      offer_payment_options: [],
      cohorts: overrides.cohorts ?? [buildCohort()],
      deals: overrides.deals ?? [],
      applications: overrides.applications ?? [],
      enrollments: [],
      tasks: overrides.tasks ?? [],
      waitlist_entries: overrides.waitlist_entries ?? [],
    } as any),
    silent: true,
    latency: 0,
  });
  return { dataProvider };
};

describe("submitApplication — Living Example (individual offer)", () => {
  it("new applicant: creates Contact + Application + Opportunity + Review Application Task", async () => {
    const { dataProvider } = buildFixtures();

    const result = await submitApplication(dataProvider, {
      offerId: LE_OFFER_ID,
      firstName: "Grace",
      lastName: "Hopper",
      email: "grace@example.com",
      answers: { why_this_program: "Ready for a change." },
    });

    expect(result.status).toBe("submitted");
    if (result.status !== "submitted") throw new Error("unreachable");

    const { data: contacts } = await dataProvider.getList("contacts", {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(contacts).toHaveLength(1);
    expect(contacts[0].first_name).toBe("Grace");
    expect(contacts[0].email_jsonb).toEqual([
      { email: "grace@example.com", type: "Other" },
    ]);

    const { data: deals } = await dataProvider.getList<Deal>("deals", {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(deals).toHaveLength(1);
    expect(deals[0].offer_id).toBe(LE_OFFER_ID);
    expect(deals[0].cohort_id).toBeNull();
    expect(deals[0].stage).toBe("application_received");
    expect(deals[0].entry_path).toBe("application_form");
    expect(deals[0].outcome).toBeNull();

    const { data: application } = await dataProvider.getOne<Application>(
      "applications",
      { id: result.applicationId },
    );
    expect(application.opportunity_id).toBe(deals[0].id);
    expect(application.status).toBe("pending");
    expect(application.submitted_at).toBeTruthy();
    expect(application.raw_answers).toEqual({
      why_this_program: "Ready for a change.",
    });

    const { data: tasks } = await dataProvider.getList<Task>("tasks", {
      filter: { type: "review_application" },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].status).toBe("pending");
    expect(tasks[0].done_date).toBeFalsy();
  });

  // Acceptance-repair pass: dashboard/DashboardTasks.tsx filters its own
  // task query by `filter: { sales_id: identity?.id }` (the logged-in
  // user's own tasks) — a Task created with no sales_id at all (public
  // submission has no logged-in identity to attribute it to) silently
  // never matched that filter and so never appeared on the Dashboard, even
  // though it fully existed (visible on the Contact page's own unfiltered
  // task list). This asserts against the EXACT same filter shape the
  // Dashboard uses, not just that a task exists somewhere.
  it("creates the Review Application Task with the administrator Sale's id, so the Dashboard's own sales_id-filtered query finds it", async () => {
    const { dataProvider } = buildFixtures();

    await submitApplication(dataProvider, {
      offerId: LE_OFFER_ID,
      firstName: "Lau",
      lastName: "Repair",
      email: "lau.repair@example.com",
      answers: { why_this_program: "..." },
    });

    // createCrmDb's own default sales fixture is the administrator (id 0)
    // — see @/test/StoryWrapper.tsx's baseSale.
    const { data: dashboardVisibleTasks } = await dataProvider.getList<Task>(
      "tasks",
      {
        filter: { sales_id: 0 },
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    expect(dashboardVisibleTasks).toHaveLength(1);
    expect(dashboardVisibleTasks[0]!.type).toBe("review_application");
    expect(dashboardVisibleTasks[0]!.status).toBe("pending");
  });

  it("reuses an existing Contact matched by normalized email (case/whitespace-insensitive)", async () => {
    const { dataProvider } = buildFixtures({
      contacts: [
        {
          id: CONTACT_ID,
          first_name: "Grace",
          last_name: "Hopper",
          email_jsonb: [{ email: "grace@example.com", type: "Work" }],
        },
      ],
    });

    const result = await submitApplication(dataProvider, {
      offerId: LE_OFFER_ID,
      firstName: "Grace",
      lastName: "H.",
      email: "  Grace@Example.com  ",
      answers: { why_this_program: "..." },
    });
    expect(result.status).toBe("submitted");

    const { data: contacts } = await dataProvider.getList("contacts", {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(contacts).toHaveLength(1);
    // Never overwrites existing Contact data, even though the form
    // submitted a different last name.
    expect(contacts[0].last_name).toBe("Hopper");
  });

  it("does not create duplicate Contacts from case/whitespace email differences", async () => {
    const { dataProvider } = buildFixtures({
      contacts: [
        {
          id: CONTACT_ID,
          email_jsonb: [{ email: "grace@example.com", type: "Work" }],
        },
      ],
    });

    await submitApplication(dataProvider, {
      offerId: LE_OFFER_ID,
      firstName: "Grace",
      lastName: "Hopper",
      email: "GRACE@EXAMPLE.COM",
      answers: { why_this_program: "..." },
    });

    const { total } = await dataProvider.getList("contacts", {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(total).toBe(1);
  });

  it("is idempotent: a duplicate submit (double-click / refresh) reuses the same Application, not a second one", async () => {
    const { dataProvider } = buildFixtures();

    const input = {
      offerId: LE_OFFER_ID,
      firstName: "Grace",
      lastName: "Hopper",
      email: "grace@example.com",
      answers: { why_this_program: "..." },
    };

    const first = await submitApplication(dataProvider, input);
    const second = await submitApplication(dataProvider, input);

    expect(first.status).toBe("submitted");
    expect(second.status).toBe("submitted");
    if (first.status !== "submitted" || second.status !== "submitted") {
      throw new Error("unreachable");
    }
    expect(second.applicationId).toBe(first.applicationId);

    const { total: applicationCount } = await dataProvider.getList(
      "applications",
      {
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    expect(applicationCount).toBe(1);

    const { total: dealCount } = await dataProvider.getList("deals", {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(dealCount).toBe(1);

    const { total: taskCount } = await dataProvider.getList("tasks", {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(taskCount).toBe(1);
  });

  // Idempotency-refinement pass (real-infrastructure verification found
  // an exact retry and a deliberate, content-changed resubmission were
  // being treated identically — both just reused the original Application
  // untouched, silently discarding a genuine correction). These three
  // tests pin the refined contract precisely.
  it("exact retry (byte-for-byte identical answers) while pending is a true no-op: unchanged submitted_at, Contact/Deal/Task untouched", async () => {
    const { dataProvider } = buildFixtures();
    const input = {
      offerId: LE_OFFER_ID,
      firstName: "Ada",
      lastName: "Retry",
      email: "ada.retry@example.com",
      answers: { why_this_program: "Exact retry test." },
    };

    const first = await submitApplication(dataProvider, input);
    expect(first.status).toBe("submitted");
    if (first.status !== "submitted") throw new Error("unreachable");

    const { data: applicationAfterFirst } =
      await dataProvider.getOne<Application>("applications", {
        id: first.applicationId,
      });
    const { data: contactsBefore } = await dataProvider.getList<Contact>(
      "contacts",
      {
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    const { data: dealsBefore } = await dataProvider.getList<Deal>("deals", {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    const { data: tasksBefore } = await dataProvider.getList<Task>("tasks", {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });

    // A real tick, so an incorrect timestamp bump would be observable.
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await submitApplication(dataProvider, input);
    expect(second.status).toBe("submitted");
    if (second.status !== "submitted") throw new Error("unreachable");
    expect(second.applicationId).toBe(first.applicationId);

    const { data: applicationAfterSecond } =
      await dataProvider.getOne<Application>("applications", {
        id: first.applicationId,
      });
    expect(applicationAfterSecond.submitted_at).toBe(
      applicationAfterFirst.submitted_at,
    );
    expect(applicationAfterSecond.raw_answers).toEqual(
      applicationAfterFirst.raw_answers,
    );

    const { data: contactsAfter, total: contactCount } =
      await dataProvider.getList<Contact>("contacts", {
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      });
    expect(contactCount).toBe(1);
    expect(contactsAfter[0]!.last_seen).toBe(contactsBefore[0]!.last_seen);

    const { data: dealsAfter, total: dealCount } =
      await dataProvider.getList<Deal>("deals", {
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      });
    expect(dealCount).toBe(1);
    expect(dealsAfter[0]).toEqual(dealsBefore[0]);

    const { data: tasksAfter, total: taskCount } =
      await dataProvider.getList<Task>("tasks", {
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      });
    expect(taskCount).toBe(1);
    expect(tasksAfter[0]).toEqual(tasksBefore[0]);
  });

  it("a materially changed pending resubmission updates raw_answers and submitted_at in place, with no duplicate Contact/Deal/Application/Task and no Task reset", async () => {
    const { dataProvider } = buildFixtures();
    const baseInput = {
      offerId: LE_OFFER_ID,
      firstName: "Ada",
      lastName: "Update",
      email: "ada.update@example.com",
      answers: { why_this_program: "Original answer." },
    };

    const first = await submitApplication(dataProvider, baseInput);
    expect(first.status).toBe("submitted");
    if (first.status !== "submitted") throw new Error("unreachable");

    const { data: applicationAfterFirst } =
      await dataProvider.getOne<Application>("applications", {
        id: first.applicationId,
      });
    const { data: tasksBefore } = await dataProvider.getList<Task>("tasks", {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });

    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await submitApplication(dataProvider, {
      ...baseInput,
      answers: { why_this_program: "UPDATED, corrected answer." },
    });
    expect(second.status).toBe("submitted");
    if (second.status !== "submitted") throw new Error("unreachable");
    // Same Application row reused, not a second one.
    expect(second.applicationId).toBe(first.applicationId);

    const { data: applicationAfterSecond } =
      await dataProvider.getOne<Application>("applications", {
        id: first.applicationId,
      });
    expect(applicationAfterSecond.raw_answers).toEqual({
      why_this_program: "UPDATED, corrected answer.",
    });
    expect(applicationAfterSecond.submitted_at).not.toBe(
      applicationAfterFirst.submitted_at,
    );
    expect(
      new Date(applicationAfterSecond.submitted_at).getTime(),
    ).toBeGreaterThan(new Date(applicationAfterFirst.submitted_at).getTime());

    const { total: contactCount } = await dataProvider.getList("contacts", {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(contactCount).toBe(1);
    const { total: dealCount } = await dataProvider.getList("deals", {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(dealCount).toBe(1);
    const { total: applicationCount } = await dataProvider.getList(
      "applications",
      {
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    expect(applicationCount).toBe(1);

    const { data: tasksAfter, total: taskCount } =
      await dataProvider.getList<Task>("tasks", {
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      });
    expect(taskCount).toBe(1);
    expect(tasksAfter[0]!.due_date).toBe(tasksBefore[0]!.due_date);
    expect(tasksAfter[0]!.status).toBe(tasksBefore[0]!.status);
  });

  // Application Intake Atomicity + Idempotency slice, root-cause regression:
  // before this fix, the exact-retry fast path trusted "Application
  // matches" alone as proof the whole prior submission had fully
  // completed. It didn't — a prior attempt where Task creation failed (or,
  // pre-fix, any partial-write failure) left a pending Application with a
  // permanently missing Review Task that NO retry could ever repair, since
  // every identical resubmission just hit the same fast path and returned
  // immediately. This fixture reproduces exactly that partial state by
  // hand (Contact + Deal + matching-answers Application, deliberately no
  // Task) and asserts a resubmission now completes the missing step
  // instead of silently no-op'ing forever.
  it("repairs a Contact/Deal/Application left with no Review Task by a prior partial failure, instead of permanently no-op'ing on retry", async () => {
    const staleDeal: Deal = {
      id: 42,
      name: "Grace Hopper — The Living Example",
      contact_id: CONTACT_ID,
      offer_id: LE_OFFER_ID,
      cohort_id: null,
      stage: "application_received",
      outcome: null,
      owner_decision: null,
      amount: 4000,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      sales_id: 0,
      index: 0,
      stage_entered_at: "2026-01-01T00:00:00.000Z",
    };
    const staleApplication: Application = {
      id: 77,
      opportunity_id: staleDeal.id,
      status: "pending",
      submitted_at: "2026-01-01T00:00:00.000Z",
      reviewed_at: null,
      raw_answers: { why_this_program: "Ready for a change." },
      summary: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const { dataProvider } = buildFixtures({
      contacts: [
        {
          id: CONTACT_ID,
          first_name: "Grace",
          last_name: "Hopper",
          email_jsonb: [{ email: "grace@example.com", type: "Work" }],
        },
      ],
      deals: [staleDeal],
      applications: [staleApplication],
      // Deliberately no Task — the exact partial state a prior failed
      // attempt would have left behind.
    });

    const result = await submitApplication(dataProvider, {
      offerId: LE_OFFER_ID,
      firstName: "Grace",
      lastName: "Hopper",
      email: "grace@example.com",
      // Byte-for-byte identical to the stale Application's own answers —
      // exactly the input that used to trigger the unrepairable fast path.
      answers: { why_this_program: "Ready for a change." },
    });

    expect(result.status).toBe("submitted");
    if (result.status !== "submitted") throw new Error("unreachable");
    // Reuses the existing Application/Deal — still no duplicate created.
    expect(result.applicationId).toBe(staleApplication.id);

    const { total: dealCount } = await dataProvider.getList("deals", {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(dealCount).toBe(1);
    const { total: applicationCount } = await dataProvider.getList(
      "applications",
      {
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    expect(applicationCount).toBe(1);

    const { data: tasks, total: taskCount } = await dataProvider.getList<Task>(
      "tasks",
      {
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    expect(taskCount).toBe(1);
    expect(tasks[0]!.type).toBe("review_application");
    expect(tasks[0]!.contact_id).toBe(CONTACT_ID);
    expect(tasks[0]!.done_date).toBeFalsy();
  });

  it("a later legitimate reapplication, once the prior Deal is no longer active, creates a fresh Deal + Application rather than reusing or overwriting the old one", async () => {
    const pastDeal: Deal = {
      id: 999,
      name: "Returning Applicant — The Living Example",
      contact_id: CONTACT_ID,
      offer_id: LE_OFFER_ID,
      cohort_id: null,
      stage: "won",
      outcome: null,
      owner_decision: null,
      amount: 4000,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      sales_id: 0,
      index: 0,
      stage_entered_at: "2026-01-01T00:00:00.000Z",
    } as Deal;
    const pastApplication: Application = {
      id: 555,
      opportunity_id: 999,
      status: "approved",
      submitted_at: "2026-01-01T00:00:00.000Z",
      reviewed_at: "2026-01-02T00:00:00.000Z",
      raw_answers: { why_this_program: "First time around." },
      summary: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const { dataProvider } = buildFixtures({
      contacts: [
        {
          id: CONTACT_ID,
          email_jsonb: [{ email: "returning@example.com", type: "Work" }],
        },
      ],
      deals: [pastDeal],
      applications: [pastApplication],
    });

    const result = await submitApplication(dataProvider, {
      offerId: LE_OFFER_ID,
      firstName: "Returning",
      lastName: "Applicant",
      email: "returning@example.com",
      answers: { why_this_program: "Applying again, later." },
    });

    expect(result.status).toBe("submitted");
    if (result.status !== "submitted") throw new Error("unreachable");
    expect(result.applicationId).not.toBe(pastApplication.id);

    const { data: newApplication } = await dataProvider.getOne<Application>(
      "applications",
      { id: result.applicationId },
    );
    expect(newApplication.raw_answers).toEqual({
      why_this_program: "Applying again, later.",
    });

    // The prior cycle's already-reviewed Application is untouched.
    const { data: oldApplicationStillIntact } =
      await dataProvider.getOne<Application>("applications", {
        id: pastApplication.id,
      });
    expect(oldApplicationStillIntact.status).toBe("approved");
    expect(oldApplicationStillIntact.raw_answers).toEqual({
      why_this_program: "First time around.",
    });

    const { total: dealCount } = await dataProvider.getList("deals", {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(dealCount).toBe(2);
  });

  it("rejects an invalid offer id without creating any record", async () => {
    const { dataProvider } = buildFixtures();

    const result = await submitApplication(dataProvider, {
      offerId: 999,
      firstName: "Grace",
      lastName: "Hopper",
      email: "grace@example.com",
      answers: {},
    });
    expect(result.status).toBe("offer-invalid");

    const { total } = await dataProvider.getList("contacts", {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(total).toBe(0);
  });

  it("rejects a missing name / invalid email as a validation error, without creating any record", async () => {
    const { dataProvider } = buildFixtures();

    const result = await submitApplication(dataProvider, {
      offerId: LE_OFFER_ID,
      firstName: "  ",
      lastName: "Hopper",
      email: "not-an-email",
      answers: {},
    });
    expect(result.status).toBe("validation-error");

    const { total } = await dataProvider.getList("contacts", {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(total).toBe(0);
  });

  it("rejects an answer over the length cap as a validation error, without creating any record (rate-limiting/abuse-protection pass)", async () => {
    const { dataProvider } = buildFixtures();

    const result = await submitApplication(dataProvider, {
      offerId: LE_OFFER_ID,
      firstName: "Too",
      lastName: "Long",
      email: "too.long@example.com",
      answers: { why_this_program: "x".repeat(5001) },
    });
    expect(result.status).toBe("validation-error");

    const { total } = await dataProvider.getList("contacts", {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(total).toBe(0);
  });

  it("accepts an answer exactly at the length cap", async () => {
    const { dataProvider } = buildFixtures();

    const result = await submitApplication(dataProvider, {
      offerId: LE_OFFER_ID,
      firstName: "Exactly",
      lastName: "AtCap",
      email: "exactly.at.cap@example.com",
      answers: { why_this_program: "x".repeat(5000) },
    });
    expect(result.status).toBe("submitted");
  });

  it("converts a matching active Waitlist entry (§13 sync invariant)", async () => {
    const { dataProvider } = buildFixtures({
      waitlist_entries: [
        {
          id: 1,
          contact_id: CONTACT_ID,
          offer_id: LE_OFFER_ID,
          cohort_id: null,
          status: "waiting",
          joined_at: "2026-01-01T00:00:00.000Z",
          desired_timing: null,
          notes: null,
          priority: null,
          source: null,
          invited_at: null,
          converted_at: null,
          converted_opportunity_id: null,
          removed_at: null,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      contacts: [
        {
          id: CONTACT_ID,
          email_jsonb: [{ email: "grace@example.com", type: "Work" }],
        },
      ],
    });

    await submitApplication(dataProvider, {
      offerId: LE_OFFER_ID,
      firstName: "Grace",
      lastName: "Hopper",
      email: "grace@example.com",
      answers: { why_this_program: "..." },
    });

    const { data: entry } = await dataProvider.getOne<WaitlistEntry>(
      "waitlist_entries",
      { id: 1 },
    );
    expect(entry.status).toBe("converted");
  });

  it("Do Not Engage: auto-resolves silently — Application already reviewed, Opportunity already exited, no Review Application Task", async () => {
    const { dataProvider } = buildFixtures({
      contacts: [
        {
          id: CONTACT_ID,
          email_jsonb: [{ email: "grace@example.com", type: "Work" }],
          sales_eligibility: "do_not_engage",
        },
      ],
    });

    const result = await submitApplication(dataProvider, {
      offerId: LE_OFFER_ID,
      firstName: "Grace",
      lastName: "Hopper",
      email: "grace@example.com",
      answers: { why_this_program: "..." },
    });
    expect(result.status).toBe("submitted");
    if (result.status !== "submitted") throw new Error("unreachable");
    expect(result.dneAutoResolved).toBe(true);

    const { data: application } = await dataProvider.getOne<Application>(
      "applications",
      { id: result.applicationId },
    );
    expect(application.status).toBe("do_not_engage");
    expect(application.reviewed_at).toBeTruthy();

    const { data: deals } = await dataProvider.getList<Deal>("deals", {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(deals).toHaveLength(1);
    expect(deals[0].outcome).toBe("lost");
    expect(deals[0].owner_decision).toBe("do_not_engage");

    const { total: taskCount } = await dataProvider.getList("tasks", {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(taskCount).toBe(0);
  });

  it("Do Not Engage: never reuses an existing active Deal — creates a fresh, already-exited one instead", async () => {
    const existingActiveDeal: Deal = {
      id: 5,
      name: "Grace Hopper — The Living Example",
      contact_id: CONTACT_ID,
      offer_id: LE_OFFER_ID,
      cohort_id: null,
      stage: "interested",
      outcome: null,
      owner_decision: null,
      amount: 4000,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      sales_id: 0,
      index: 0,
      stage_entered_at: "2026-01-01T00:00:00.000Z",
    };
    const { dataProvider } = buildFixtures({
      contacts: [
        {
          id: CONTACT_ID,
          email_jsonb: [{ email: "grace@example.com", type: "Work" }],
          sales_eligibility: "do_not_engage",
        },
      ],
      deals: [existingActiveDeal],
    });

    await submitApplication(dataProvider, {
      offerId: LE_OFFER_ID,
      firstName: "Grace",
      lastName: "Hopper",
      email: "grace@example.com",
      answers: { why_this_program: "..." },
    });

    const { data: deals } = await dataProvider.getList<Deal>("deals", {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    // The pre-existing active Deal is untouched (never silently
    // reactivated); a distinct, already-exited Deal was created for this
    // application event.
    expect(deals).toHaveLength(2);
    const original = deals.find((d) => d.id === existingActiveDeal.id)!;
    expect(original.stage).toBe("interested");
    expect(original.outcome).toBeNull();
    const created = deals.find((d) => d.id !== existingActiveDeal.id)!;
    expect(created.outcome).toBe("lost");
    expect(created.owner_decision).toBe("do_not_engage");
  });
});

describe("submitApplication — Growing Yourself Up (group offer + cohort)", () => {
  it("creates an Opportunity attached to the correct Cohort", async () => {
    const { dataProvider } = buildFixtures();

    const result = await submitApplication(dataProvider, {
      offerId: GYU_OFFER_ID,
      cohortId: COHORT_ID,
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      answers: { why_this_cohort: "...", availability: "Weekday evenings." },
    });

    expect(result.status).toBe("submitted");
    if (result.status !== "submitted") throw new Error("unreachable");

    const { data: application } = await dataProvider.getOne<Application>(
      "applications",
      { id: result.applicationId },
    );
    const { data: deal } = await dataProvider.getOne<Deal>("deals", {
      id: application.opportunity_id,
    });
    expect(deal.offer_id).toBe(GYU_OFFER_ID);
    expect(deal.cohort_id).toBe(COHORT_ID);
    expect(deal.stage).toBe("application_received");
  });

  it("rejects a group offer application with no cohort", async () => {
    const { dataProvider } = buildFixtures();

    const result = await submitApplication(dataProvider, {
      offerId: GYU_OFFER_ID,
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      answers: {},
    });
    expect(result.status).toBe("cohort-invalid");
  });

  it("rejects a cohort that belongs to a different offer (validateOfferCohort mismatch)", async () => {
    const otherGroupOfferId = 3;
    const otherOffer: Offer = {
      id: otherGroupOfferId,
      name: "A Different Group Offer",
      type: "group",
      duration: "6 weeks",
      current_price: 900,
      is_active: true,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const dataProvider = createDataProvider({
      db: createCrmDb({
        contacts: [],
        offers: [livingExample, growingYourselfUp, otherOffer],
        offer_payment_options: [],
        cohorts: [buildCohort()], // belongs to growingYourselfUp
        deals: [],
        applications: [],
        enrollments: [],
        tasks: [],
        waitlist_entries: [],
      } as any),
      silent: true,
      latency: 0,
    });

    const result = await submitApplication(dataProvider, {
      offerId: otherGroupOfferId, // mismatched: cohort belongs to GYU, not this offer
      cohortId: COHORT_ID,
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      answers: {},
    });
    expect(result.status).toBe("cohort-invalid");
  });

  it("rejects a closed Cohort (status not applications_open) without creating any record", async () => {
    const { dataProvider } = buildFixtures({
      cohorts: [buildCohort({ status: "applications_closed" })],
    });

    const result = await submitApplication(dataProvider, {
      offerId: GYU_OFFER_ID,
      cohortId: COHORT_ID,
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      answers: {},
    });
    expect(result.status).toBe("cohort-closed");

    const { total } = await dataProvider.getList("contacts", {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(total).toBe(0);
  });

  it("rejects a Cohort outside its applications_open_at/close_at window even if status is open", async () => {
    const { dataProvider } = buildFixtures({
      cohorts: [
        buildCohort({
          applications_open_at: "2099-01-01",
          applications_close_at: "2099-01-31",
        }),
      ],
    });

    const result = await submitApplication(dataProvider, {
      offerId: GYU_OFFER_ID,
      cohortId: COHORT_ID,
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      answers: {},
    });
    expect(result.status).toBe("cohort-closed");
  });

  it("rejects a missing/invalid cohort id", async () => {
    const { dataProvider } = buildFixtures();

    const result = await submitApplication(dataProvider, {
      offerId: GYU_OFFER_ID,
      cohortId: 999,
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      answers: {},
    });
    expect(result.status).toBe("cohort-invalid");
  });

  it("does not create a duplicate pending Review Application Task for a Contact who already has one", async () => {
    const { dataProvider } = buildFixtures({
      contacts: [
        {
          id: CONTACT_ID,
          email_jsonb: [{ email: "ada@example.com", type: "Work" }],
        },
      ],
      tasks: [
        {
          id: 1,
          contact_id: CONTACT_ID,
          type: "review_application",
          text: "Review Ada's earlier application",
          due_date: "2026-01-01T00:00:00.000Z",
          done_date: null,
          status: "pending",
          sales_id: 0,
        },
      ],
    });

    await submitApplication(dataProvider, {
      offerId: GYU_OFFER_ID,
      cohortId: COHORT_ID,
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      answers: { why_this_cohort: "..." },
    });

    const { total: taskCount } = await dataProvider.getList("tasks", {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(taskCount).toBe(1);
  });
});
