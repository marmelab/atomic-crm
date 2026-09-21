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
    const saveElement = (await saveButton.element()) as HTMLButtonElement;

    // A real double click: two events, in two ticks, with the product
    // given the chance to react to the first — which is the whole
    // mechanism under test.
    //
    // This used to be Promise.all([saveButton.click(), saveButton.click()])
    // and could only pass by winning a race against the behaviour it was
    // checking. The driver's click waits for the element to be "visible,
    // enabled and stable", and the first submit is what disables the
    // button — so the second click waited on a button the product had
    // correctly just disabled, retried until the dialog closed, and failed
    // with "element was detached from the DOM". On a fast machine the
    // second click sometimes landed first and it passed.
    saveElement.click();

    // The named guarantee, waited for rather than raced: the button takes
    // itself out of service. Nothing here assumes WHEN React flushes that
    // — only that it does.
    await expect.element(saveButton).toBeDisabled();

    // Now the second click, dispatched raw so it is never gated on
    // actionability. It lands on a disabled button and the DOM drops it.
    // If the guard ever regressed this event would reach the handler and
    // create a second Task, so the assertion below still catches it.
    saveElement.click();
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
