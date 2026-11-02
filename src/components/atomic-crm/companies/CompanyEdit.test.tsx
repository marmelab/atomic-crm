import type { UpdateParams } from "ra-core";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { buildCompany, buildContact, StoryWrapper } from "@/test/StoryWrapper";

vi.mock("./useCompanySectors", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./useCompanySectors")>()),
  useCompanySectors: () => ({
    sectors: [{ value: "toys", label: "Toys" }],
    error: null,
    isPending: false,
    isFetching: false,
  }),
}));

const company = buildCompany({ id: 1, name: "Toy Hub", sector: "toys" });
const ann = buildContact({
  id: 5,
  first_name: "Ann",
  last_name: "Lee",
  company_id: 1,
  is_primary: true,
  whatsapp_number: "888",
  phone_jsonb: [{ number: "999", type: "Work" }],
  email_jsonb: [{ email: "ann@toys.example", type: "Work" }],
});

describe("CompanyEdit", () => {
  it("loads the company's contacts and saves edits and new contacts with it", async () => {
    // Arrange
    const updates: UpdateParams[] = [];
    const screen = await render(
      <StoryWrapper
        initialEntries={["/companies/1"]}
        data={{ companies: [company], contacts: [ann] }}
        dataProvider={{
          update: async (_resource: string, params: UpdateParams) => {
            updates.push(params);
            return { data: { ...params.previousData, ...params.data } };
          },
        }}
      >
        {null}
      </StoryWrapper>,
    );
    await expect.element(screen.getByText("Existing contact")).toBeVisible();
    await expect
      .element(screen.getByRole("textbox", { name: "First name" }))
      .toHaveValue("Ann");
    await expect
      .element(screen.getByRole("textbox", { name: "Mobile" }))
      .toHaveValue("999");

    // Act
    await screen.getByRole("textbox", { name: "Last name" }).fill("Shaw");
    await screen.getByRole("button", { name: "Add new contact" }).click();
    await expect.element(screen.getByText("New contact")).toBeVisible();
    await screen
      .getByRole("textbox", { name: "First name" })
      .nth(1)
      .fill("Neo");
    await screen.getByRole("textbox", { name: "Last name" }).nth(1).fill("Ray");
    await screen.getByRole("button", { name: "Save" }).click();

    // Assert: the existing contact keeps its id, the new one has none
    await expect.poll(() => updates.length).toBe(1);
    const data = updates[0].data;
    expect(data).not.toHaveProperty("contact_search");
    expect(data.contacts).toEqual([
      expect.objectContaining({
        id: 5,
        first_name: "Ann",
        last_name: "Shaw",
        mobile: "999",
        whatsapp_number: "888",
        email: "ann@toys.example",
        is_primary: true,
      }),
      expect.objectContaining({
        first_name: "Neo",
        last_name: "Ray",
        is_primary: false,
      }),
    ]);
    expect(data.contacts[1].id).toBeUndefined();
  });

  it("keeps a single primary contact when another one is switched on", async () => {
    const updates: UpdateParams[] = [];
    const bob = buildContact({
      id: 6,
      first_name: "Bob",
      last_name: "Ray",
      company_id: 1,
    });
    const screen = await render(
      <StoryWrapper
        initialEntries={["/companies/1"]}
        data={{ companies: [company], contacts: [ann, bob] }}
        dataProvider={{
          update: async (_resource: string, params: UpdateParams) => {
            updates.push(params);
            return { data: { ...params.previousData, ...params.data } };
          },
        }}
      >
        {null}
      </StoryWrapper>,
    );
    const primarySwitches = screen.getByRole("switch", {
      name: "Primary contact",
    });
    await expect.element(primarySwitches.nth(0)).toBeChecked();

    await primarySwitches.nth(1).click();

    await expect.element(primarySwitches.nth(0)).not.toBeChecked();
    await screen.getByRole("button", { name: "Save" }).click();
    await expect.poll(() => updates.length).toBe(1);
    expect(
      updates[0].data.contacts.map(
        (contact: { is_primary: boolean }) => contact.is_primary,
      ),
    ).toEqual([false, true]);
  });
});
