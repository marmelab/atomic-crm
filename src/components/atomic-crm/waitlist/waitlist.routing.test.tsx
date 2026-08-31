import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { memoryStore } from "ra-core";
import { MemoryRouter } from "react-router";

import { CRM } from "../root/CRM";
import { Notification } from "@/components/admin/notification";
import { testI18nProvider } from "@/components/atomic-crm/providers/commons/i18nProvider";
import { createDataProvider } from "@/components/atomic-crm/providers/fakerest";
import {
  buildContact,
  createCrmDb,
  createTestAuthProvider,
} from "@/test/StoryWrapper";
import type { Cohort, ContactNote, Offer, WaitlistEntry } from "../types";
import type { Db } from "@/components/atomic-crm/providers/fakerest/dataGenerator/types";

// Waitlists slice, §22 (PROGRAM UI / CONTACT UI / DNE): renders the full
// <CRM> through a route, the same convention CRM.routing.test.tsx already
// established, so these exercise real routing + real data-loading rather
// than a shallow component mount.
const livingExample: Offer = {
  id: 1,
  name: "The Living Example",
  type: "individual",
  duration: "4 months",
  current_price: 4000,
  max_active_clients: 12,
  is_active: true,
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
};

const gyuOffer: Offer = {
  id: 2,
  name: "Growing Yourself Up",
  type: "group",
  duration: "8 weeks",
  current_price: 1400,
  is_active: true,
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
};

const septemberCohort: Cohort = {
  id: 1,
  offer_id: 2,
  name: "September GYU Cohort",
  status: "applications_open",
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
};

const novemberCohort: Cohort = {
  id: 2,
  offer_id: 2,
  name: "November GYU Cohort",
  status: "applications_open",
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
};

const seededContactNote: ContactNote = {
  id: 1,
  contact_id: 1,
  text: "Seed note",
  date: "2025-01-01T00:00:00.000Z",
  sales_id: 0,
  status: "warm",
};

const buildTestCrm = (
  initialEntries: string[],
  overrides: Partial<Db> = {},
) => {
  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: [buildContact({ id: 1 })],
      contact_notes: [seededContactNote],
      offers: [livingExample, gyuOffer],
      cohorts: [septemberCohort, novemberCohort],
      offer_payment_options: [],
      applications: [],
      enrollments: [],
      deals: [],
      waitlist_entries: [],
      ...overrides,
    }),
    silent: true,
    latency: 0,
  });
  const authProvider = createTestAuthProvider();
  const store = memoryStore();

  const element = (
    <MemoryRouter initialEntries={initialEntries}>
      <CRM
        dataProvider={dataProvider}
        authProvider={authProvider}
        i18nProvider={testI18nProvider}
        store={store}
        disableTelemetry
        layout={({ children }) => (
          <>
            {children}
            <Notification />
          </>
        )}
      />
    </MemoryRouter>
  );

  return { element, dataProvider };
};

const entry = (
  overrides: Partial<WaitlistEntry> &
    Pick<WaitlistEntry, "id" | "contact_id" | "offer_id">,
): WaitlistEntry => ({
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
  ...overrides,
});

describe("Living Example page — Waitlist section", () => {
  it("shows only active entries with a correct count; converted/removed are excluded", async () => {
    await page.viewport(1280, 900);
    const contacts = [
      buildContact({ id: 1, first_name: "Ada", last_name: "Lovelace" }),
      buildContact({ id: 2, first_name: "Owen", last_name: "Blake" }),
      buildContact({ id: 3, first_name: "Ivy", last_name: "Osei" }),
      buildContact({ id: 4, first_name: "Felix", last_name: "Tran" }),
    ];
    const entries = [
      entry({ id: 1, contact_id: 2, offer_id: 1, status: "waiting" }),
      entry({ id: 2, contact_id: 3, offer_id: 1, status: "converted" }),
      entry({ id: 3, contact_id: 4, offer_id: 1, status: "removed" }),
    ];

    const { element } = buildTestCrm(["/programs/individual/1"], {
      contacts,
      waitlist_entries: entries,
    });
    const screen = await render(element);

    await expect
      .element(screen.getByRole("heading", { name: "Waitlist · 1" }))
      .toBeInTheDocument();
    await expect.element(screen.getByText("Owen Blake")).toBeInTheDocument();
    await expect.element(screen.getByText("Ivy Osei")).not.toBeInTheDocument();
    await expect
      .element(screen.getByText("Felix Tran"))
      .not.toBeInTheDocument();
  });
});

describe("Group Program page (GYU general) — Waitlist section", () => {
  it("shows only offer-level entries — a cohort-specific entry never leaks in", async () => {
    await page.viewport(1280, 900);
    const contacts = [
      buildContact({ id: 1, first_name: "Dana", last_name: "Cole" }),
      buildContact({ id: 2, first_name: "Nadia", last_name: "Osei" }),
    ];
    const entries = [
      entry({
        id: 1,
        contact_id: 1,
        offer_id: 2,
        cohort_id: null,
        status: "waiting",
      }),
      entry({
        id: 2,
        contact_id: 2,
        offer_id: 2,
        cohort_id: 1,
        status: "waiting",
      }),
    ];

    const { element } = buildTestCrm(["/programs/group/2"], {
      contacts,
      waitlist_entries: entries,
    });
    const screen = await render(element);

    await expect
      .element(screen.getByRole("heading", { name: "Waitlist · 1" }))
      .toBeInTheDocument();
    await expect.element(screen.getByText("Dana Cole")).toBeInTheDocument();
    await expect
      .element(screen.getByText("Nadia Osei"))
      .not.toBeInTheDocument();
  });
});

describe("Cohort page — Waitlist section", () => {
  it("shows only that Cohort's entries — general GYU waiting and another Cohort's entries never leak in", async () => {
    await page.viewport(1280, 900);
    const contacts = [
      buildContact({ id: 1, first_name: "Malik", last_name: "Rowe" }),
      buildContact({ id: 2, first_name: "Dana", last_name: "Cole" }),
      buildContact({ id: 3, first_name: "Theo", last_name: "Marsh" }),
    ];
    const entries = [
      entry({
        id: 1,
        contact_id: 1,
        offer_id: 2,
        cohort_id: 1,
        status: "waiting",
      }),
      entry({
        id: 2,
        contact_id: 2,
        offer_id: 2,
        cohort_id: null,
        status: "waiting",
      }),
      entry({
        id: 3,
        contact_id: 3,
        offer_id: 2,
        cohort_id: 2,
        status: "waiting",
      }),
    ];

    const { element } = buildTestCrm(["/cohorts/1/show"], {
      contacts,
      waitlist_entries: entries,
    });
    const screen = await render(element);

    await expect
      .element(screen.getByRole("heading", { name: "Waitlist · 1" }))
      .toBeInTheDocument();
    await expect.element(screen.getByText("Malik Rowe")).toBeInTheDocument();
    await expect.element(screen.getByText("Dana Cole")).not.toBeInTheDocument();
    await expect
      .element(screen.getByText("Theo Marsh"))
      .not.toBeInTheDocument();
  });
});

describe("ContactShow — Waitlists section", () => {
  it("shows both an active and a historical entry, with distinct status", async () => {
    await page.viewport(1280, 900);
    const contact = buildContact({
      id: 1,
      first_name: "Sarah",
      last_name: "Jones",
    });
    const entries = [
      entry({ id: 1, contact_id: 1, offer_id: 1, status: "waiting" }),
      entry({
        id: 2,
        contact_id: 1,
        offer_id: 2,
        cohort_id: 1,
        status: "removed",
        removed_at: "2026-01-05T00:00:00.000Z",
      }),
    ];

    const { element } = buildTestCrm(["/contacts/1/show"], {
      contacts: [contact],
      waitlist_entries: entries,
    });
    const screen = await render(element);

    await expect
      .element(screen.getByText("The Living Example"))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("Growing Yourself Up — September GYU Cohort"))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("Waiting", { exact: true }))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("Removed", { exact: true }))
      .toBeInTheDocument();
  });
});

describe("Add to Waitlist — Do Not Engage guard", () => {
  it("keeps a DNE Contact selectable but blocks adding them to the waitlist", async () => {
    await page.viewport(1280, 900);
    const dneContact = buildContact({
      id: 2,
      first_name: "Willis",
      last_name: "Byrne",
      email_jsonb: [{ email: "willis.byrne@example.com", type: "Work" }],
      sales_eligibility: "do_not_engage",
    });

    const { element, dataProvider } = buildTestCrm(["/programs/individual/1"], {
      contacts: [buildContact({ id: 1 }), dneContact],
    });
    const screen = await render(element);

    await screen.getByRole("button", { name: "Add to Waitlist" }).click();
    await screen.getByText("Search by name or email…").click();
    await screen.getByPlaceholder("Search...").fill("Willis");

    // Findable — never hidden from the selector.
    await expect.element(screen.getByText("Willis Byrne")).toBeInTheDocument();
    await screen.getByText("Willis Byrne").click();

    // Unlike the Opportunity Person field, this one has no dedicated Alert —
    // the async validator's message surfaces as the field's own validation
    // error, which react-hook-form resolves on a submit attempt.
    await screen.getByRole("button", { name: /^save$/i }).click();

    await expect
      .element(
        screen.getByText(
          "This person is marked Do Not Engage — they can't be added to a waitlist.",
        ),
      )
      .toBeInTheDocument();

    // Blocked: no entry is created for them.
    const { total } = await dataProvider.getList("waitlist_entries", {
      filter: {},
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(total).toBe(0);
  });
});

// Human-acceptance repair pass, §1/§8: a real Living Example waitlist runs
// to ~50 people — the 8-row collapse keeps the page from sprawling, but a
// local search must still find someone past that boundary, and clearing it
// must restore the normal collapsed view.
describe("Waitlist search", () => {
  const manyEntries = (offset: number) =>
    Array.from({ length: 9 }, (_, i) =>
      entry({
        id: i + 1,
        contact_id: offset + i,
        offer_id: 1,
        status: "waiting",
        joined_at: `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
      }),
    );
  const manyContacts = (offset: number) => [
    ...Array.from({ length: 8 }, (_, i) =>
      buildContact({
        id: offset + i,
        first_name: `Person${i}`,
        last_name: "Common",
      }),
    ),
    buildContact({
      id: offset + 8,
      first_name: "Zelda",
      last_name: "Findable",
      email_jsonb: [{ email: "zelda.findable@example.com", type: "Home" }],
    }),
  ];

  it("finds a person past the collapsed boundary by name, regardless of collapsed state", async () => {
    await page.viewport(1280, 900);
    const { element } = buildTestCrm(["/programs/individual/1"], {
      contacts: manyContacts(100),
      waitlist_entries: manyEntries(100),
    });
    const screen = await render(element);

    await expect
      .element(screen.getByRole("heading", { name: "Waitlist · 9" }))
      .toBeInTheDocument();
    // Not visible yet — past the 8-row collapse.
    await expect
      .element(screen.getByText("Zelda Findable"))
      .not.toBeInTheDocument();

    await screen.getByPlaceholder("Search name or email…").fill("Zelda");

    await expect
      .element(screen.getByText("Zelda Findable"))
      .toBeInTheDocument();
    // The collapse's own "N more" toggle is irrelevant while filtered.
    await expect
      .element(screen.getByText("Person0 Common"))
      .not.toBeInTheDocument();
  });

  it("finds a person by email", async () => {
    await page.viewport(1280, 900);
    const { element } = buildTestCrm(["/programs/individual/1"], {
      contacts: manyContacts(200),
      waitlist_entries: manyEntries(200),
    });
    const screen = await render(element);

    await screen
      .getByPlaceholder("Search name or email…")
      .fill("zelda.findable@example.com");

    await expect
      .element(screen.getByText("Zelda Findable"))
      .toBeInTheDocument();
  });

  it("shows a no-match message for a query nobody matches, and clearing it restores the collapsed view", async () => {
    await page.viewport(1280, 900);
    const { element } = buildTestCrm(["/programs/individual/1"], {
      contacts: manyContacts(300),
      waitlist_entries: manyEntries(300),
    });
    const screen = await render(element);

    const search = screen.getByPlaceholder("Search name or email…");
    await search.fill("nobody-matches-this");
    await expect
      .element(screen.getByText("No one matches “nobody-matches-this”."))
      .toBeInTheDocument();

    await search.fill("");
    await expect
      .element(screen.getByText("Zelda Findable"))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByText("Person0 Common"))
      .toBeInTheDocument();
  });

  it("stays hidden on a short list (below the collapse threshold)", async () => {
    await page.viewport(1280, 900);
    const { element } = buildTestCrm(["/programs/individual/1"], {
      contacts: [
        buildContact({ id: 400, first_name: "Solo", last_name: "Waiter" }),
      ],
      waitlist_entries: [
        entry({ id: 1, contact_id: 400, offer_id: 1, status: "waiting" }),
      ],
    });
    const screen = await render(element);

    await expect.element(screen.getByText("Solo Waiter")).toBeInTheDocument();
    await expect
      .element(screen.getByPlaceholder("Search name or email…"))
      .not.toBeInTheDocument();
  });
});

// Human-acceptance repair pass, §2/§8: quick-creating a brand-new person
// from Add to Waitlist must select them immediately and keep the form
// open — the root cause was AddToWaitlistSheet.tsx's defaultValues
// recomputing a fresh joined_at on every render, resetting the whole form
// out from under the just-created selection (see that file's comment).
describe("Add to Waitlist — quick-create selects and keeps the form open", () => {
  it("creates the Contact, selects them immediately, and Save creates exactly one Waitlist Entry for them", async () => {
    await page.viewport(1280, 900);
    const { element, dataProvider } = buildTestCrm(["/programs/individual/1"], {
      contacts: [buildContact({ id: 1 })],
    });
    const screen = await render(element);

    await screen.getByRole("button", { name: "Add to Waitlist" }).click();
    await screen.getByText("Search by name or email…").click();
    await screen.getByPlaceholder("Search...").fill("Brand New Person");
    await screen.getByText('Add "Brand New Person" as a new person').click();

    // Selected immediately — the sheet stays open with them populated,
    // never reverting to the placeholder.
    await expect
      .element(screen.getByText("Brand New Person"))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("Search by name or email…"))
      .not.toBeInTheDocument();

    await screen.getByRole("button", { name: /^save$/i }).click();

    await expect
      .poll(async () => {
        const { total } = await dataProvider.getList("waitlist_entries", {
          filter: {},
          pagination: { page: 1, perPage: 10 },
          sort: { field: "id", order: "ASC" },
        });
        return total;
      })
      .toBe(1);

    const { data: contacts } = await dataProvider.getList("contacts", {
      filter: {},
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    // Exactly one Contact created for them — no duplicate.
    expect(
      contacts.filter(
        (c) => c.first_name === "Brand" && c.last_name === "New Person",
      ),
    ).toHaveLength(1);
  });
});

// Human-acceptance repair pass, §3/§7/§8: ContactShow gets a direct path
// into sales — Convert to Opportunity for an active Waitlist Entry (reuses
// the SAME centralized convertToOpportunity as the Program pages), or a
// prefilled + New Opportunity when there is no active entry.
describe("ContactShow — direct Opportunity actions", () => {
  it("Convert to Opportunity: creates the Opportunity, marks the entry Converted, and navigates to it", async () => {
    await page.viewport(1280, 900);
    const contact = buildContact({
      id: 5,
      first_name: "Owen",
      last_name: "Blake",
    });
    const { element } = buildTestCrm(["/contacts/5/show"], {
      contacts: [contact],
      waitlist_entries: [
        entry({ id: 1, contact_id: 5, offer_id: 1, status: "invited" }),
      ],
    });
    const screen = await render(element);

    await expect
      .element(screen.getByRole("button", { name: "Convert to Opportunity" }))
      .toBeInTheDocument();
    // No "New Opportunity" fallback while an active entry exists.
    await expect
      .element(screen.getByRole("button", { name: "New Opportunity" }))
      .not.toBeInTheDocument();

    await screen
      .getByRole("button", { name: "Convert to Opportunity" })
      .click();

    // Navigated straight to the resulting Opportunity (DealShow's dialog).
    await expect
      .element(screen.getByRole("heading", { name: "Owen Blake" }))
      .toBeInTheDocument();
    await expect
      .element(screen.getByRole("dialog").getByText("Interested"))
      .toBeInTheDocument();
  });

  it("+ New Opportunity: prefills the Contact in the existing Create form — never re-search", async () => {
    await page.viewport(1280, 900);
    const contact = buildContact({
      id: 6,
      first_name: "Priya",
      last_name: "Nair",
    });
    const { element } = buildTestCrm(["/contacts/6/show"], {
      contacts: [contact],
    });
    const screen = await render(element);

    await expect
      .element(screen.getByRole("button", { name: "Convert to Opportunity" }))
      .not.toBeInTheDocument();

    await screen.getByRole("button", { name: "New Opportunity" }).click();

    // The Person field already shows Priya — never a blank search box.
    await expect.element(screen.getByText("Priya Nair")).toBeInTheDocument();
    await expect
      .element(screen.getByText("Search by name or email…"))
      .not.toBeInTheDocument();
  });

  it("Do Not Engage remains blocked from Convert to Opportunity, and the Contact is never hidden", async () => {
    await page.viewport(1280, 900);
    const dneContact = buildContact({
      id: 7,
      first_name: "Willis",
      last_name: "Byrne",
      sales_eligibility: "do_not_engage",
    });
    const { element, dataProvider } = buildTestCrm(["/contacts/7/show"], {
      contacts: [dneContact],
      waitlist_entries: [
        entry({ id: 1, contact_id: 7, offer_id: 1, status: "waiting" }),
      ],
    });
    const screen = await render(element);

    await expect.element(screen.getByText("Willis Byrne")).toBeInTheDocument();
    await screen
      .getByRole("button", { name: "Convert to Opportunity" })
      .click();

    // Blocked: still on the Contact page, no Opportunity created, entry
    // still Waiting.
    await expect
      .poll(async () => {
        const { total } = await dataProvider.getList("deals", {
          filter: {},
          pagination: { page: 1, perPage: 10 },
          sort: { field: "id", order: "ASC" },
        });
        return total;
      })
      .toBe(0);
    const { data: entryAfter } = await dataProvider.getOne("waitlist_entries", {
      id: 1,
    });
    expect(entryAfter.status).toBe("waiting");
  });
});
