import { CoreAdminContext, Form } from "ra-core";
import { useWatch } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { testI18nProvider } from "@/components/atomic-crm/providers/commons/i18nProvider";

import { AutocompleteArrayInput } from "./autocomplete-array-input";

const TagsValue = () => {
  const tags = useWatch({ name: "tags" });
  return <output aria-label="tags value">{JSON.stringify(tags)}</output>;
};

const renderInput = (
  onCreate: (filter?: string) => unknown,
  choices: { id: string; name: string }[],
) =>
  render(
    <CoreAdminContext i18nProvider={testI18nProvider}>
      <Form record={{ tags: ["tech"] }}>
        <AutocompleteArrayInput
          source="tags"
          choices={choices}
          onCreate={onCreate}
        />
        <TagsValue />
      </Form>
    </CoreAdminContext>,
  );

const createFromFilter = async (
  screen: Awaited<ReturnType<typeof renderInput>>,
  filter: string,
) => {
  await screen.getByPlaceholder("Search").fill(filter);
  await screen.getByRole("option", { name: "Create" }).click();
};

describe("AutocompleteArrayInput", () => {
  it("appends the record returned by onCreate to the selection", async () => {
    // Arrange
    const choices = [{ id: "tech", name: "Tech" }];
    const screen = await renderInput((filter) => {
      const newChoice = { id: "foo", name: filter ?? "" };
      choices.push(newChoice);
      return newChoice;
    }, choices);

    // Act
    await createFromFilter(screen, "Foo");

    // Assert
    await expect
      .element(screen.getByLabelText("tags value"))
      .toHaveTextContent('["tech","foo"]');
  });

  it("keeps the value unchanged when onCreate returns nothing", async () => {
    // Arrange
    const screen = await renderInput(
      () => undefined,
      [{ id: "tech", name: "Tech" }],
    );

    // Act
    await createFromFilter(screen, "Foo");

    // Assert: the create sentinel is not stored in the selection
    await expect
      .element(screen.getByLabelText("tags value"))
      .toHaveTextContent('["tech"]');
  });

  it("does not duplicate a created record that is already selected", async () => {
    // Arrange
    const choices = [{ id: "tech", name: "Tech" }];
    const screen = await renderInput(() => choices[0], choices);

    // Act
    await createFromFilter(screen, "Tech");

    // Assert
    await expect
      .element(screen.getByLabelText("tags value"))
      .toHaveTextContent('["tech"]');
  });
});
