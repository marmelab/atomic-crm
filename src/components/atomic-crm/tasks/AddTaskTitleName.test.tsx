import {
  CoreAdminContext,
  ResourceContextProvider,
  memoryStore,
} from "ra-core";
import type { ReactNode } from "react";
import { render } from "vitest-browser-react";

import { testI18nProvider } from "@/components/atomic-crm/providers/commons/i18nProvider";
import { createDataProvider } from "@/components/atomic-crm/providers/fakerest";
import {
  buildContact,
  createCrmDb,
  createTestAuthProvider,
} from "@/test/StoryWrapper";
import type { Contact } from "../types";
import { AddTask } from "./AddTask";

// The dialog must call the person by name, whatever React Admin's resource
// registry has got around to.
//
// AddTask used to title itself with useGetRecordRepresentation("contacts"),
// which reads the `contacts` resource definition out of the registry. That
// registry fills in as the <Resource> tree mounts, and ra-core's fallback
// when the entry is not there yet is a chain:
//
//     record.name -> record.title -> record.label -> record.reference -> #id
//
// A Contact has no `name`, so the first thing that matched was `title` —
// the person's JOB title. The dialog said "Create task for CTO", and for
// anyone with no job title recorded, "Create task for #1". Worse, the
// representation is captured in a useCallback, so it never corrected
// itself once the registry filled in.
//
// It surfaced as a "flaky" browser test that rotated between dialog specs
// and always passed in isolation. It was a real defect a real person could
// see, and the reason it hid so well is that StoryWrapper renders the whole
// <CRM>, which registers every resource before the children mount — so the
// ordinary test harness could never reproduce it.
//
// These tests deliberately do NOT use that harness. They mount AddTask in a
// bare ra-core context with NO resource definitions registered at all,
// which is the state the app passes through on its way up, and the state
// the old implementation could not survive.
const NoResourceDefinitions = ({ children }: { children: ReactNode }) => (
  <CoreAdminContext
    authProvider={createTestAuthProvider()}
    dataProvider={createDataProvider({ db: createCrmDb(), silent: true })}
    i18nProvider={testI18nProvider}
    store={memoryStore()}
  >
    <ResourceContextProvider value="contacts">
      {children}
    </ResourceContextProvider>
  </CoreAdminContext>
);

const openDialogFor = async (contact: Contact) => {
  const screen = await render(
    <NoResourceDefinitions>
      <AddTask contact={contact} />
    </NoResourceDefinitions>,
  );
  await screen.getByRole("button", { name: /add task|create task/i }).click();
  return screen;
};

describe("AddTask dialog title — named from the Contact, not the registry", () => {
  it("uses the Contact's own name with no resource definitions registered", async () => {
    const screen = await openDialogFor(
      buildContact({ id: 1, first_name: "Maya", last_name: "Chen" }),
    );

    await expect
      .element(screen.getByText("Create task for Maya Chen"))
      .toBeVisible();
  });

  it("never shows the person's JOB title as their name", async () => {
    // buildContact carries title: "CTO". This is the exact string the old
    // implementation produced, and the one a real user would have seen.
    const screen = await openDialogFor(
      buildContact({
        id: 1,
        first_name: "Maya",
        last_name: "Chen",
        title: "CTO",
      }),
    );

    await expect
      .element(screen.getByText("Create task for Maya Chen"))
      .toBeVisible();
    await expect
      .element(screen.getByText("Create task for CTO"))
      .not.toBeInTheDocument();
  });

  it("never falls back to #<id>", async () => {
    // With no job title either, the old fallback chain ran all the way to
    // the record id.
    const screen = await openDialogFor(
      buildContact({
        id: 7,
        first_name: "Maya",
        last_name: "Chen",
        title: "",
      }),
    );

    await expect
      .element(screen.getByText("Create task for Maya Chen"))
      .toBeVisible();
    await expect
      .element(screen.getByText("Create task for #7"))
      .not.toBeInTheDocument();
  });

  it("names someone who has only one name, with no stray space", async () => {
    // 33 Contacts here carry a single name, which is why
    // contactDisplayName exists at all.
    const screen = await openDialogFor(
      buildContact({
        id: 2,
        first_name: "Prince",
        last_name: null as unknown as Contact["last_name"],
        title: "",
      }),
    );

    await expect
      .element(screen.getByText("Create task for Prince"))
      .toBeVisible();
  });

  it("says plain 'Create task' when the CRM does not know the name, rather than inventing one", async () => {
    // Nothing here fabricates. An unnamed Contact gets the same neutral
    // title the contact-picker variant shows — never an id, never a job.
    const screen = await openDialogFor(
      buildContact({
        id: 3,
        first_name: null as unknown as Contact["first_name"],
        last_name: null as unknown as Contact["last_name"],
        title: "CFO",
      }),
    );

    await expect.element(screen.getByText("Create task")).toBeVisible();
    await expect
      .element(screen.getByText("Create task for CFO"))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByText("Create task for #3"))
      .not.toBeInTheDocument();
  });
});
