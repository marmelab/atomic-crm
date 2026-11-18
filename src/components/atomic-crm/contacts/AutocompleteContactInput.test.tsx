import { Form } from "ra-core";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { ReferenceArrayInput } from "@/components/admin/reference-array-input";
import { buildContact, StoryWrapper } from "@/test/StoryWrapper";

import { AutocompleteContactInput } from "./AutocompleteContactInput";

describe("AutocompleteContactInput", () => {
  it("shows a selected contact as a name-only chip", async () => {
    // Arrange
    const screen = await render(
      <StoryWrapper
        data={{ contacts: [buildContact({ id: 1, title: "CTO" })] }}
      >
        <Form record={{ contact_ids: [1] }}>
          <ReferenceArrayInput
            source="contact_ids"
            reference="contacts_summary"
          >
            <AutocompleteContactInput label="Contacts" />
          </ReferenceArrayInput>
        </Form>
      </StoryWrapper>,
    );

    // Assert
    await expect.element(screen.getByText(/Ada Lovelace/)).toBeVisible();
    await expect.element(screen.getByText("CTO")).not.toBeInTheDocument();
  });
});
