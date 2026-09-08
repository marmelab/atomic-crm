import {
  ResourceContextProvider,
  ShowBase,
  useDataProvider,
  type DataProvider,
} from "ra-core";
import { render } from "vitest-browser-react";
import { buildContact, StoryWrapper } from "@/test/StoryWrapper";
import { ContactAside } from "./ContactAside";
import { ContactShow } from "./ContactShow";
import { MobileSuccess } from "./ContactShow.mobile.stories";

const mockIsMobile = vi.hoisted(() => vi.fn(() => true));
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: mockIsMobile,
}));

describe("ContactShow", () => {
  beforeEach(() => {
    mockIsMobile.mockReturnValue(true);
  });

  it("renders a safe zero-task label before nb_tasks is available", async () => {
    const screen = await render(<MobileSuccess />);

    await expect
      .element(screen.getByRole("tab", { name: "0 tasks" }))
      .toBeVisible();
    await expect
      .poll(
        () => screen.container.textContent?.includes("%{smart_count}") ?? false,
      )
      .toBe(false);
    await expect
      .poll(() => screen.container.textContent?.includes("||||") ?? false)
      .toBe(false);
  });

  it("updates the contact status from the aside", async () => {
    mockIsMobile.mockReturnValue(false);

    let dataProvider: DataProvider | null = null;
    const contact = buildContact({ status: "warm" });

    const DataProviderListener = () => {
      dataProvider = useDataProvider();
      return null;
    };

    const screen = await render(
      <StoryWrapper data={{ contacts: [contact] }}>
        <DataProviderListener />
        <ResourceContextProvider value="contacts">
          <ShowBase id={contact.id}>
            <ContactAside />
          </ShowBase>
        </ResourceContextProvider>
      </StoryWrapper>,
    );

    await expect
      .element(screen.getByRole("combobox"))
      .toHaveTextContent("Warm");

    await screen.getByRole("combobox").click();
    await screen.getByRole("option", { name: /hot/i }).click();

    await expect
      .poll(async () => {
        const { data } = await dataProvider!.getOne("contacts", {
          id: contact.id,
        });
        return data.status;
      })
      .toBe("hot");

    await expect.element(screen.getByRole("combobox")).toHaveTextContent("Hot");
  });

  // Native Applications repair pass, §3: the durable Contact-level Sales
  // Eligibility gate must be unmistakable on the Contact itself, not only
  // visible on the Application that set it.
  it("shows a Do Not Engage badge for a DNE Contact (desktop)", async () => {
    mockIsMobile.mockReturnValue(false);
    const contact = buildContact({
      first_name: "Willis",
      last_name: "Byrne",
      sales_eligibility: "do_not_engage",
    });

    const screen = await render(
      <StoryWrapper data={{ contacts: [contact] }}>
        <ResourceContextProvider value="contacts">
          <ContactShow id={contact.id} />
        </ResourceContextProvider>
      </StoryWrapper>,
    );

    await expect.element(screen.getByText("Do Not Engage")).toBeInTheDocument();
  });

  it("does not show a Do Not Engage badge for a normal Contact (desktop)", async () => {
    mockIsMobile.mockReturnValue(false);
    const contact = buildContact({
      first_name: "Ada",
      last_name: "Lovelace",
      sales_eligibility: "normal",
    });

    const screen = await render(
      <StoryWrapper data={{ contacts: [contact] }}>
        <ResourceContextProvider value="contacts">
          <ContactShow id={contact.id} />
        </ResourceContextProvider>
      </StoryWrapper>,
    );

    await expect.element(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    await expect
      .element(screen.getByText("Do Not Engage"))
      .not.toBeInTheDocument();
  });

  // Manual Task UX repair: proves the fix through the REAL mobile page,
  // not just ContactTasksList in isolation — the Tasks tab's "Add task"
  // used to disappear the moment this Contact had a first task.
  it("F/G: mobile ContactShow's Tasks tab exposes Add Task even with an existing Task", async () => {
    mockIsMobile.mockReturnValue(true);
    // nb_tasks is a denormalized counter the dataProvider maintains
    // incrementally on tasks create/update/delete (see
    // providers/fakerest/dataProvider.ts) — seeding a task directly into
    // the fixture db, as below, does NOT recompute it, so it's set
    // explicitly here to match what a real Contact with one task has.
    const contact = buildContact({
      id: 1,
      first_name: "Maya",
      last_name: "Chen",
      nb_tasks: 1,
    });

    const screen = await render(
      <StoryWrapper
        data={{
          contacts: [contact],
          tasks: [
            {
              id: 1,
              contact_id: 1,
              type: "other",
              text: "Ask about scheduling",
              due_date: "2026-01-05T09:00:00.000Z",
              status: "pending",
              sales_id: 0,
            },
          ],
        }}
      >
        <ResourceContextProvider value="contacts">
          <ContactShow id={contact.id} />
        </ResourceContextProvider>
      </StoryWrapper>,
    );

    await screen.getByRole("tab", { name: "1 task" }).click();
    await expect
      .element(screen.getByRole("button", { name: "Add task" }))
      .toBeVisible();
  });

  it("shows a Do Not Engage badge for a DNE Contact (mobile)", async () => {
    mockIsMobile.mockReturnValue(true);
    const contact = buildContact({
      first_name: "Willis",
      last_name: "Byrne",
      sales_eligibility: "do_not_engage",
    });

    const screen = await render(
      <StoryWrapper data={{ contacts: [contact] }}>
        <ResourceContextProvider value="contacts">
          <ContactShow id={contact.id} />
        </ResourceContextProvider>
      </StoryWrapper>,
    );

    await expect.element(screen.getByText("Do Not Engage")).toBeInTheDocument();
  });
});
