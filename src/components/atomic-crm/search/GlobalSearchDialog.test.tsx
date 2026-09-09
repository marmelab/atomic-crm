import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { StoryWrapper, buildContact } from "@/test/StoryWrapper";

import { GlobalSearchDialog } from "./GlobalSearchDialog";

const PLACEHOLDER = "Search contacts, companies, deals, tasks and notes...";

const data = {
  companies: [
    { id: 1, name: "Boulangerie Martin", sector: "Food" },
    { id: 2, name: "Acme Corp", sector: "Tech" },
  ],
  contacts: [
    buildContact({ company_id: 1, company_name: "Boulangerie Martin", id: 1 }),
  ],
  contact_notes: [
    {
      contact_id: 1,
      date: "2025-02-01T10:00:00.000Z",
      id: 1,
      sales_id: 0,
      status: "warm",
      text: "Called about the sourdough contract",
    },
  ],
} as any;

const renderDialog = (open = true) =>
  render(
    <StoryWrapper data={data}>
      <GlobalSearchDialog open={open} onOpenChange={() => {}} />
    </StoryWrapper>,
  );

describe("GlobalSearchDialog", () => {
  it("puts nothing in the document while closed", async () => {
    const screen = await renderDialog(false);

    // The dialog's accessible description mentions every searchable resource,
    // so leaking it into a closed dialog breaks text queries app-wide.
    await expect.element(screen.getByText(PLACEHOLDER)).not.toBeInTheDocument();
    await expect
      .element(screen.getByPlaceholder(PLACEHOLDER))
      .not.toBeInTheDocument();
  });

  it("asks for a longer query before searching", async () => {
    const screen = await renderDialog();

    await screen.getByPlaceholder(PLACEHOLDER).fill("a");

    await expect
      .element(screen.getByText("Type at least 2 characters to search"))
      .toBeVisible();
  });

  it("finds a company by name", async () => {
    const screen = await renderDialog();

    await screen.getByPlaceholder(PLACEHOLDER).fill("Boulangerie");

    await expect
      .element(
        screen
          .getByRole("group", { name: "Companies" })
          .getByText("Boulangerie Martin"),
      )
      .toBeVisible();
  });

  it("also surfaces the contacts of a matching company", async () => {
    const screen = await renderDialog();

    await screen.getByPlaceholder(PLACEHOLDER).fill("Boulangerie");

    await expect
      .element(
        screen
          .getByRole("group", { name: "Contacts" })
          .getByText("Ada Lovelace"),
      )
      .toBeVisible();
  });

  it("finds a note by its text, which no page-specific search can do", async () => {
    const screen = await renderDialog();

    await screen.getByPlaceholder(PLACEHOLDER).fill("sourdough");

    await expect.element(screen.getByText("Contact notes")).toBeVisible();
    await expect
      .element(screen.getByText("Called about the sourdough contract"))
      .toBeVisible();
  });

  it("shows the note's contact as the result subtitle", async () => {
    const screen = await renderDialog();

    await screen.getByPlaceholder(PLACEHOLDER).fill("sourdough");

    await expect.element(screen.getByText("Ada Lovelace")).toBeVisible();
  });

  it("reports when nothing matches", async () => {
    const screen = await renderDialog();

    await screen.getByPlaceholder(PLACEHOLDER).fill("zzzzznomatch");

    await expect.element(screen.getByText("No result found")).toBeVisible();
  });
});
