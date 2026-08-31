import { beforeAll, describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { createDataProvider } from "@/components/atomic-crm/providers/fakerest";
import { buildContact, createCrmDb, StoryWrapper } from "@/test/StoryWrapper";
import type { Offer } from "@/components/atomic-crm/types";

// Programs + Opportunity UX slice, §1/§2/§15: the Opportunity "Person"
// field must (a) create exactly one new Contact and link the Opportunity
// to it when no match exists, and (b) reuse an existing Contact — never
// duplicating it — when one is selected from search.
// ra-data-fakerest throws "Undefined collection" for any resource missing
// entirely from the seeded db (createCrmDb's own defaults don't include
// these), so every test here seeds them explicitly, even empty.
const emptyRelatedCollections = {
  offer_payment_options: [],
  cohorts: [],
  applications: [],
  enrollments: [],
};

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

const selectOfferAndSave = async (
  screen: Awaited<ReturnType<typeof render>>,
) => {
  await screen.getByLabelText(/offer/i).click();
  await screen.getByText("The Living Example").click();
  // The Offer selection commits (and its Popover finishes closing) a beat
  // after the click; wait for the Potential Value auto-fill (§3) it
  // triggers before submitting, so Save doesn't race an unsettled offer_id.
  await expect
    .poll(
      () =>
        (
          screen
            .getByLabelText(/potential value/i)
            .element() as HTMLInputElement
        ).value,
    )
    .toBe("4000");
  await screen.getByRole("button", { name: /^save$/i }).click();
};

describe("OpportunityPersonInput", () => {
  beforeAll(() => {
    page.viewport(1600, 900);
  });

  it("creates exactly one Contact and links a new Opportunity to it for a brand-new person", async () => {
    // An unrelated pre-existing Contact so DealList's empty state (which
    // gates the Create dialog behind "add your first contact" when there
    // are none at all — a pre-existing, unrelated behavior) doesn't hide
    // the form under test.
    const unrelated = buildContact({
      id: 99,
      first_name: "Ola",
      last_name: "Existing",
    });
    const dataProvider = createDataProvider({
      db: createCrmDb({
        offers: [livingExample],
        contacts: [unrelated],
        ...emptyRelatedCollections,
      }),
      silent: true,
    });

    const screen = await render(
      <StoryWrapper
        initialEntries={["/deals/create"]}
        dataProvider={dataProvider}
      >
        <></>
      </StoryWrapper>,
    );

    await screen.getByText("Search by name or email…").click();
    await screen.getByPlaceholder("Search...").fill("Zelda Newperson");
    await screen.getByText('Add "Zelda Newperson" as a new person').click();

    // The new Contact is created asynchronously (FakeRest's simulated
    // network latency); wait for the popover to actually close — not just
    // for "Zelda Newperson" text to appear anywhere, which can transiently
    // match the still-open "Add ... as a new person" option itself — so
    // the field's real form value is committed before moving on.
    await expect
      .element(screen.getByText('Add "Zelda Newperson" as a new person'))
      .not.toBeInTheDocument();

    // The newly created Contact is immediately selected as the Person.
    await expect
      .element(screen.getByText("Zelda Newperson"))
      .toBeInTheDocument();

    await selectOfferAndSave(screen);

    await expect
      .poll(
        async () =>
          (
            await dataProvider.getList("deals", {
              filter: {},
              pagination: { page: 1, perPage: 10 },
              sort: { field: "id", order: "ASC" },
            })
          ).total,
      )
      .toBe(1);

    const { data: contacts } = await dataProvider.getList("contacts", {
      filter: {},
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    const newPeople = contacts.filter(
      (c) => c.first_name === "Zelda" && c.last_name === "Newperson",
    );
    expect(newPeople).toHaveLength(1);

    const { data: deals } = await dataProvider.getList("deals", {
      filter: {},
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(deals).toHaveLength(1);
    expect(deals[0]).toMatchObject({
      contact_id: newPeople[0]!.id,
      name: "Zelda Newperson",
      offer_id: livingExample.id,
    });
  });

  it("reuses an existing Contact found via search, without creating a duplicate", async () => {
    const existingChris = buildContact({
      id: 5,
      first_name: "Chris",
      last_name: "Smith",
      email_jsonb: [{ email: "chris.smith@example.com", type: "Work" }],
    });
    const dataProvider = createDataProvider({
      db: createCrmDb({
        offers: [livingExample],
        contacts: [existingChris],
        ...emptyRelatedCollections,
      }),
      silent: true,
    });

    const screen = await render(
      <StoryWrapper
        initialEntries={["/deals/create"]}
        dataProvider={dataProvider}
      >
        <></>
      </StoryWrapper>,
    );

    await screen.getByText("Search by name or email…").click();
    await screen.getByPlaceholder("Search...").fill("Chris");
    await screen.getByText("Chris Smith").click();

    await selectOfferAndSave(screen);

    await expect
      .poll(
        async () =>
          (
            await dataProvider.getList("deals", {
              filter: {},
              pagination: { page: 1, perPage: 10 },
              sort: { field: "id", order: "ASC" },
            })
          ).total,
      )
      .toBe(1);

    const { data: contacts } = await dataProvider.getList("contacts", {
      filter: {},
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(contacts.filter((c) => c.last_name === "Smith")).toHaveLength(1);

    const { data: deals } = await dataProvider.getList("deals", {
      filter: {},
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(deals).toHaveLength(1);
    expect(deals[0]).toMatchObject({
      contact_id: existingChris.id,
      name: "Chris Smith",
    });
  });

  // Native Applications repair pass, §4: a Do Not Engage Contact must stay
  // findable/selectable here (removing them would just invite an
  // accidental duplicate Contact) — but selecting them must clearly
  // indicate why, and Save must not create the Opportunity.
  it("keeps a Do Not Engage Contact selectable in the Person field, but blocks creating a new Opportunity for them", async () => {
    const dneContact = buildContact({
      id: 7,
      first_name: "Willis",
      last_name: "Byrne",
      email_jsonb: [{ email: "willis.byrne@example.com", type: "Work" }],
      sales_eligibility: "do_not_engage",
    });
    const dataProvider = createDataProvider({
      db: createCrmDb({
        offers: [livingExample],
        contacts: [dneContact],
        ...emptyRelatedCollections,
      }),
      silent: true,
    });

    const screen = await render(
      <StoryWrapper
        initialEntries={["/deals/create"]}
        dataProvider={dataProvider}
      >
        <></>
      </StoryWrapper>,
    );

    await screen.getByText("Search by name or email…").click();
    await screen.getByPlaceholder("Search...").fill("Willis");
    // Findable — never hidden from the selector.
    await expect.element(screen.getByText("Willis Byrne")).toBeInTheDocument();
    await screen.getByText("Willis Byrne").click();

    // Clearly indicated immediately upon selection.
    await expect
      .element(
        screen.getByText(
          "This person is marked Do Not Engage — a new Opportunity can't be created for them.",
        ),
      )
      .toBeInTheDocument();

    await selectOfferAndSave(screen);

    // Blocked: no Opportunity is created for them.
    const { total } = await dataProvider.getList("deals", {
      filter: {},
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(total).toBe(0);
  });
});
