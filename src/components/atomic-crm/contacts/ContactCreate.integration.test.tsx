import { render } from "vitest-browser-react";

import {
  createCrmDb,
  createCrmScenario,
  CrmTestProvider,
} from "@/test/browser/atomic-crm/crmUiHarness";
import { ContactCreate } from "./ContactCreate";

// We use pessimistic mode to avoid the 5s undoable delay in tests.
export const ContactCreateHarness = () => (
  <ContactCreate mutationMode="pessimistic" />
);

/**
 * Create a scenario whose dataProvider.create is wrapped in a vi.fn(),
 * so we can assert on what data the transform sends to the backend.
 */
const createScenarioWithCreateMock = (
  ...args: Parameters<typeof createCrmScenario>
) => {
  const scenario = createCrmScenario(...args);
  const originalCreate = scenario.dataProvider.create;
  const createMock = vi.fn(
    async (...createArgs: Parameters<typeof originalCreate>) =>
      originalCreate(...createArgs),
  );
  scenario.dataProvider = { ...scenario.dataProvider, create: createMock };
  return { scenario, createMock };
};

describe("ContactCreate integration", () => {
  it("shows empty email and phone placeholder inputs", async () => {
    const scenario = createCrmScenario({ db: createCrmDb() });

    const screen = await render(
      <CrmTestProvider
        scenario={scenario}
        resource="contacts"
        initialEntries={["/contacts/create"]}
      >
        <ContactCreateHarness />
      </CrmTestProvider>,
    );

    await expect.element(screen.getByPlaceholder("Email")).toBeInTheDocument();
    await expect
      .element(screen.getByPlaceholder("Phone number"))
      .toBeInTheDocument();
  });

  it("does not submit empty email and phone entries", async () => {
    const { scenario, createMock } = createScenarioWithCreateMock({
      db: createCrmDb(),
    });

    const screen = await render(
      <CrmTestProvider
        scenario={scenario}
        resource="contacts"
        initialEntries={["/contacts/create"]}
      >
        <ContactCreateHarness />
      </CrmTestProvider>,
    );

    await expect.element(screen.getByPlaceholder("Email")).toBeInTheDocument();

    // Fill required fields only
    await screen.getByLabelText(/first name/i).fill("Ada");
    await screen.getByLabelText(/last name/i).fill("Lovelace");

    await screen.getByRole("button", { name: /^save$/i }).click();

    await expect.poll(() => createMock.mock.calls.length).toBe(1);

    const createData = createMock.mock.calls[0][1].data;
    expect(createData.email_jsonb).toBeNull();
    expect(createData.phone_jsonb).toBeNull();
    expect(createData.first_seen).toBeDefined();
    expect(createData.last_seen).toBeDefined();
    expect(createData.tags).toEqual([]);
  });

  it("submits only filled email and phone entries, stripping empty ones", async () => {
    const { scenario, createMock } = createScenarioWithCreateMock({
      db: createCrmDb(),
    });

    const screen = await render(
      <CrmTestProvider
        scenario={scenario}
        resource="contacts"
        initialEntries={["/contacts/create"]}
      >
        <ContactCreateHarness />
      </CrmTestProvider>,
    );

    await expect.element(screen.getByPlaceholder("Email")).toBeInTheDocument();

    // Fill required fields
    await screen.getByLabelText(/first name/i).fill("Ada");
    await screen.getByLabelText(/last name/i).fill("Lovelace");

    // Fill email but leave phone empty
    await screen.getByPlaceholder("Email").fill("ada@example.com");

    await screen.getByRole("button", { name: /^save$/i }).click();

    await expect.poll(() => createMock.mock.calls.length).toBe(1);

    const createData = createMock.mock.calls[0][1].data;
    expect(createData.email_jsonb).toEqual([
      { email: "ada@example.com", type: "Work" },
    ]);
    expect(createData.phone_jsonb).toBeNull();
  });

  it("submits both email and phone when filled", async () => {
    const { scenario, createMock } = createScenarioWithCreateMock({
      db: createCrmDb(),
    });

    const screen = await render(
      <CrmTestProvider
        scenario={scenario}
        resource="contacts"
        initialEntries={["/contacts/create"]}
      >
        <ContactCreateHarness />
      </CrmTestProvider>,
    );

    await expect.element(screen.getByPlaceholder("Email")).toBeInTheDocument();

    // Fill required fields
    await screen.getByLabelText(/first name/i).fill("Ada");
    await screen.getByLabelText(/last name/i).fill("Lovelace");

    // Fill both email and phone
    await screen.getByPlaceholder("Email").fill("ada@example.com");
    await screen.getByPlaceholder("Phone number").fill("+1234567890");

    await screen.getByRole("button", { name: /^save$/i }).click();

    await expect.poll(() => createMock.mock.calls.length).toBe(1);

    const createData = createMock.mock.calls[0][1].data;
    expect(createData.email_jsonb).toEqual([
      { email: "ada@example.com", type: "Work" },
    ]);
    expect(createData.phone_jsonb).toEqual([
      { number: "+1234567890", type: "Work" },
    ]);
  });
});
