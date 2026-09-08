import {
  ResourceContextProvider,
  ShowBase,
  useDataProvider,
  type DataProvider,
} from "ra-core";
import { render } from "vitest-browser-react";
import { buildContact, StoryWrapper } from "@/test/StoryWrapper";
import { AddTask } from "./AddTask";

// Manual Task UX repair — regression coverage for the two callers this
// repair deliberately left untouched (J: desktop ContactShow's
// ContactAside, K: desktop Dashboard). Both keep working exactly as
// before: AddTask's new `contact` prop is optional and additive, used
// only by ClientShow (see ClientShow.tasks.test.tsx).
describe("AddTask", () => {
  it("J: reads the Contact off record context by default (ContactAside's own usage — no `contact` prop)", async () => {
    const contact = buildContact({
      id: 1,
      first_name: "Maya",
      last_name: "Chen",
    });

    const screen = await render(
      <StoryWrapper data={{ contacts: [contact] }}>
        <ResourceContextProvider value="contacts">
          <ShowBase id={contact.id}>
            <AddTask />
          </ShowBase>
        </ResourceContextProvider>
      </StoryWrapper>,
    );

    await screen.getByRole("button", { name: "Add task" }).click();
    await expect
      .element(screen.getByText("Create task for Maya Chen"))
      .toBeVisible();
    // No Contact picker — it's already known from context, same as
    // before this repair.
    await expect
      .element(screen.getByRole("combobox", { name: /^Contact/ }))
      .not.toBeInTheDocument();
  });

  it("K: requires manual Contact selection with selectContact and no record context (Dashboard's own usage)", async () => {
    const contact = buildContact({
      id: 1,
      first_name: "Maya",
      last_name: "Chen",
    });

    const screen = await render(
      <StoryWrapper data={{ contacts: [contact] }}>
        <AddTask selectContact />
      </StoryWrapper>,
    );

    await screen.getByRole("button", { name: "Add task" }).click();
    await expect.element(screen.getByText("Create task")).toBeVisible();
    await expect
      .element(screen.getByRole("combobox", { name: /^Contact/ }))
      .toBeVisible();
  });

  it("L: the Save button disables itself immediately on submit (existing framework guard — no duplicate Task from a rapid double click)", async () => {
    const contact = buildContact({
      id: 1,
      first_name: "Maya",
      last_name: "Chen",
    });
    let dataProvider: DataProvider | null = null;
    const DataProviderListener = () => {
      dataProvider = useDataProvider();
      return null;
    };

    const screen = await render(
      <StoryWrapper data={{ contacts: [contact] }}>
        <DataProviderListener />
        <ResourceContextProvider value="contacts">
          <ShowBase id={contact.id}>
            <AddTask />
          </ShowBase>
        </ResourceContextProvider>
      </StoryWrapper>,
    );

    await screen.getByRole("button", { name: "Add task" }).click();
    // Waits for the Contact to be resolved off record context (same
    // check test J makes) before racing the Save button — otherwise the
    // very first click could itself land before contact_id is known,
    // which would be a test-setup race, not the thing under test.
    await expect
      .element(screen.getByText("Create task for Maya Chen"))
      .toBeVisible();
    await screen
      .getByRole("textbox")
      .first()
      .fill("Follow up about payment plan");

    const saveButton = screen.getByRole("button", { name: "Save" });
    // Two clicks fired concurrently (not sequenced one-mutation-then-the-
    // next) — the real shape of a duplicate-click race. react-hook-form's
    // own isSubmitting flips the button to `disabled` synchronously with
    // the first click, before the second can be handled as a second
    // submit.
    await Promise.all([saveButton.click(), saveButton.click()]);

    await expect
      .poll(async () => {
        const { data } = await dataProvider!.getList("tasks", {
          filter: { contact_id: 1 },
          pagination: { page: 1, perPage: 10 },
          sort: { field: "id", order: "ASC" },
        });
        return data.length;
      })
      .toBe(1);
  });
});
