import { render } from "vitest-browser-react";

import {
  buildContact,
  createCrmDb,
  createCrmScenario,
  CrmTestProvider,
} from "@/test/browser/atomic-crm/crmUiHarness";
import { Route, Routes } from "react-router";
import { ContactEdit } from "./ContactEdit";

// EditBase reads the record id from the route params, so we mount a Route.
// We use pessimistic mode to avoid the 5s undoable delay in tests.
export const ContactEditHarness = () => (
  <Routes>
    <Route
      path="/contacts/:id"
      element={<ContactEdit mutationMode="pessimistic" />}
    />
  </Routes>
);

/**
 * Create a scenario whose dataProvider.update is wrapped in a vi.fn(),
 * so we can assert on what data the transform sends to the backend.
 */
const createScenarioWithUpdateMock = (
  ...args: Parameters<typeof createCrmScenario>
) => {
  const scenario = createCrmScenario(...args);
  const originalUpdate = scenario.dataProvider.update;
  const updateMock = vi.fn(
    async (...updateArgs: Parameters<typeof originalUpdate>) =>
      originalUpdate(...updateArgs),
  );
  // Build a new dataProvider object so CoreAdminContext sees the mock
  scenario.dataProvider = { ...scenario.dataProvider, update: updateMock };
  return { scenario, updateMock };
};

describe("ContactEdit integration", () => {
  it("shows empty email and phone inputs when the contact has none", async () => {
    const scenario = createCrmScenario({
      db: createCrmDb({
        contacts: [
          buildContact({
            id: 1,
            email_jsonb: [],
            phone_jsonb: [],
          }),
        ] as any,
      }),
    });

    const screen = await render(
      <CrmTestProvider
        scenario={scenario}
        resource="contacts"
        initialEntries={["/contacts/1"]}
      >
        <ContactEditHarness />
      </CrmTestProvider>,
    );

    // The form should display one empty email placeholder input
    await expect.element(screen.getByPlaceholder("Email")).toBeInTheDocument();

    // The form should display one empty phone placeholder input
    await expect
      .element(screen.getByPlaceholder("Phone number"))
      .toBeInTheDocument();
  });

  it("does not submit empty email and phone entries", async () => {
    const { scenario, updateMock } = createScenarioWithUpdateMock({
      db: createCrmDb({
        contacts: [
          buildContact({
            id: 1,
            email_jsonb: [],
            phone_jsonb: [],
          }),
        ] as any,
      }),
    });

    const screen = await render(
      <CrmTestProvider
        scenario={scenario}
        resource="contacts"
        initialEntries={["/contacts/1"]}
      >
        <ContactEditHarness />
      </CrmTestProvider>,
    );

    // Wait for the form to load
    await expect.element(screen.getByPlaceholder("Email")).toBeInTheDocument();

    // Submit without filling anything
    await screen.getByRole("button", { name: /^save$/i }).click();

    // Wait for the update call to complete
    await expect.poll(() => updateMock.mock.calls.length).toBe(1);

    // Verify the transform cleaned up the empty arrays
    const updateData = updateMock.mock.calls[0][1].data;
    expect(updateData.email_jsonb).toBeNull();
    expect(updateData.phone_jsonb).toBeNull();
  });

  it("submits only filled email and phone entries, stripping empty ones", async () => {
    const { scenario, updateMock } = createScenarioWithUpdateMock({
      db: createCrmDb({
        contacts: [
          buildContact({
            id: 1,
            email_jsonb: [],
            phone_jsonb: [],
          }),
        ] as any,
      }),
    });

    const screen = await render(
      <CrmTestProvider
        scenario={scenario}
        resource="contacts"
        initialEntries={["/contacts/1"]}
      >
        <ContactEditHarness />
      </CrmTestProvider>,
    );

    // Wait for the form to load and fill in the email
    const emailInput = screen.getByPlaceholder("Email");
    await expect.element(emailInput).toBeInTheDocument();
    await emailInput.fill("ada@example.com");

    // Leave the phone input empty and submit
    await screen.getByRole("button", { name: /^save$/i }).click();

    // Wait for the update call to complete
    await expect.poll(() => updateMock.mock.calls.length).toBe(1);

    // Verify: email saved, phone cleaned to null
    const updateData = updateMock.mock.calls[0][1].data;
    expect(updateData.email_jsonb).toEqual([
      { email: "ada@example.com", type: "Work" },
    ]);
    expect(updateData.phone_jsonb).toBeNull();
  });

  it("preserves existing email and phone entries on edit", async () => {
    const { scenario, updateMock } = createScenarioWithUpdateMock({
      db: createCrmDb({
        contacts: [
          buildContact({
            id: 1,
            email_jsonb: [{ email: "ada@example.com", type: "Work" }],
            phone_jsonb: [{ number: "+1234567890", type: "Home" }],
          }),
        ] as any,
      }),
    });

    const screen = await render(
      <CrmTestProvider
        scenario={scenario}
        resource="contacts"
        initialEntries={["/contacts/1"]}
      >
        <ContactEditHarness />
      </CrmTestProvider>,
    );

    // Wait for existing values to appear
    const emailInput = screen.getByPlaceholder("Email");
    await expect.element(emailInput).toHaveValue("ada@example.com");

    const phoneInput = screen.getByPlaceholder("Phone number");
    await expect.element(phoneInput).toHaveValue("+1234567890");

    // Submit without changes
    await screen.getByRole("button", { name: /^save$/i }).click();

    // Wait for the update call to complete
    await expect.poll(() => updateMock.mock.calls.length).toBe(1);

    // Verify existing data is preserved through the transform
    const updateData = updateMock.mock.calls[0][1].data;
    expect(updateData.email_jsonb).toEqual([
      { email: "ada@example.com", type: "Work" },
    ]);
    expect(updateData.phone_jsonb).toEqual([
      { number: "+1234567890", type: "Home" },
    ]);
  });
});
