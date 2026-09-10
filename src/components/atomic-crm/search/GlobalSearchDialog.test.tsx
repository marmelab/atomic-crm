import { page } from "vitest/browser";
import { beforeEach, describe, expect, it } from "vitest";
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
  deals: [
    {
      company_id: 1,
      created_at: "2025-01-05T10:00:00.000Z",
      description: "sourdough supply",
      id: 1,
      name: "Live sourdough deal",
      stage: "opportunity",
    },
    {
      archived_at: "2025-01-20T10:00:00.000Z",
      company_id: 1,
      created_at: "2025-01-06T10:00:00.000Z",
      id: 2,
      name: "Archived sourdough deal",
      stage: "lost",
    },
  ],
  tasks: [
    {
      contact_id: 1,
      created_at: "2025-01-10T10:00:00.000Z",
      due_date: "2027-01-01T10:00:00.000Z",
      id: 1,
      sales_id: 0,
      text: "Chase the sourdough quote",
      type: "Call",
    },
    {
      contact_id: 1,
      created_at: "2025-01-11T10:00:00.000Z",
      done_date: "2025-01-12T10:00:00.000Z",
      due_date: "2025-01-15T10:00:00.000Z",
      id: 2,
      sales_id: 0,
      text: "Finished sourdough task",
      type: "Call",
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
  // The dialog reads useIsMobile, and the layouts expose different resources,
  // so the viewport is part of the arrangement in every test below.
  beforeEach(() => {
    page.viewport(1600, 900);
  });

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

    await expect
      .element(
        screen
          .getByRole("group", { name: "Contact notes" })
          .getByText("Ada Lovelace"),
      )
      .toBeVisible();
  });

  it("matches a note word together with its contact's name", async () => {
    const screen = await renderDialog();

    // The reason `content` carries the subtitle: each word is ANDed, so the
    // parent name has to be searchable on the note's own row.
    await screen.getByPlaceholder(PLACEHOLDER).fill("sourdough Lovelace");

    await expect
      .element(
        screen
          .getByRole("group", { name: "Contact notes" })
          .getByText("Called about the sourdough contract"),
      )
      .toBeVisible();
  });

  it("shows the deal's company as its subtitle", async () => {
    const screen = await renderDialog();

    await screen.getByPlaceholder(PLACEHOLDER).fill("sourdough");

    await expect
      .element(
        screen
          .getByRole("group", { name: "Deals" })
          .getByText("Boulangerie Martin"),
      )
      .toBeVisible();
  });

  it("hides archived deals and completed tasks", async () => {
    const screen = await renderDialog();

    await screen.getByPlaceholder(PLACEHOLDER).fill("sourdough");

    await expect.element(screen.getByText("Live sourdough deal")).toBeVisible();
    await expect
      .element(screen.getByText("Archived sourdough deal"))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByText("Finished sourdough task"))
      .not.toBeInTheDocument();
  });

  it("reports when nothing matches", async () => {
    const screen = await renderDialog();

    await screen.getByPlaceholder(PLACEHOLDER).fill("zzzzznomatch");

    await expect.element(screen.getByText("No result found")).toBeVisible();
  });
});

describe("GlobalSearchDialog on mobile", () => {
  beforeEach(() => {
    page.viewport(375, 667);
  });

  it("omits deals, which have no page on the mobile layout", async () => {
    const screen = await renderDialog();

    await screen.getByPlaceholder(PLACEHOLDER).fill("sourdough");

    // The note matches too, so a visible result proves the query ran.
    await expect
      .element(screen.getByText("Called about the sourdough contract"))
      .toBeVisible();
    await expect
      .element(screen.getByText("Live sourdough deal"))
      .not.toBeInTheDocument();
  });

  it("still finds tasks, which link to their contact", async () => {
    const screen = await renderDialog();

    await screen.getByPlaceholder(PLACEHOLDER).fill("sourdough");

    await expect
      .element(
        screen
          .getByRole("group", { name: "Tasks" })
          .getByText("Chase the sourdough quote"),
      )
      .toBeVisible();
  });
});
