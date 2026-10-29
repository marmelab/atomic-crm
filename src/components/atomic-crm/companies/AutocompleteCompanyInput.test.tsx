import { Form } from "ra-core";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { ReferenceInput } from "@/components/admin/reference-input";
import { buildCompany, StoryWrapper } from "@/test/StoryWrapper";

import { AutocompleteCompanyInput } from "./AutocompleteCompanyInput";

describe("AutocompleteCompanyInput", () => {
  it("keeps the current company when creating a new one fails", async () => {
    // Arrange: a record already linked to Acme, and a create that rejects.
    const screen = await render(
      <StoryWrapper
        data={{ companies: [buildCompany({ id: 1, name: "Acme" })] }}
        dataProvider={{
          create: () => Promise.reject(new Error("Network error")),
        }}
      >
        <Form record={{ company_id: 1 }}>
          <ReferenceInput source="company_id" reference="companies">
            <AutocompleteCompanyInput label="Company" />
          </ReferenceInput>
        </Form>
      </StoryWrapper>,
    );
    const combobox = screen.getByRole("combobox", { name: "Company" });
    await expect.element(combobox).toHaveTextContent("Acme");

    // Act
    await combobox.click();
    await screen.getByPlaceholder("Search...").fill("Foo");
    await screen.getByRole("option", { name: "Create Foo" }).click();

    // Assert: the error is reported and the create sentinel was not stored
    // in place of the selected company.
    await expect
      .element(screen.getByText("An error occurred while creating the company"))
      .toBeVisible();
    await expect.element(combobox).toHaveTextContent("Acme");
  });
});
