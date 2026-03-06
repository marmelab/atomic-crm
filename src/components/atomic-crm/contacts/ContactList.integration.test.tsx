import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  buildContact,
  createCrmDb,
  createCrmScenario,
  CrmTestProvider,
  DesktopContactListContentHarness,
  DesktopContactListHarness,
  MobileContactListContentHarness,
} from "@/test/browser/atomic-crm/crmUiHarness";

describe("Contact list integration", () => {
  it("renders the empty state in the desktop list", async () => {
    const scenario = createCrmScenario({
      db: createCrmDb(),
    });

    render(
      <CrmTestProvider resource="contacts" scenario={scenario}>
        <DesktopContactListHarness />
      </CrmTestProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "No contacts found" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("It seems your contact list is empty."),
    ).toBeVisible();
  });

  it("renders contacts in the desktop success state", async () => {
    const scenario = createCrmScenario({
      db: createCrmDb({
        contacts: [
          buildContact({
            first_name: "Ada",
            id: 1,
            last_name: "Lovelace",
            last_seen: "2025-01-05T10:00:00.000Z",
            title: "CTO",
          }),
          buildContact({
            first_name: "Grace",
            id: 2,
            last_name: "Hopper",
            last_seen: "2025-01-06T11:00:00.000Z",
            title: "Rear Admiral",
          }),
        ] as any,
      }),
    });

    render(
      <CrmTestProvider resource="contacts" scenario={scenario}>
        <DesktopContactListHarness />
      </CrmTestProvider>,
    );

    expect(await screen.findByText("Ada Lovelace")).toBeVisible();
    expect(screen.getByText("Grace Hopper")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "No contacts found" })).toBeNull();
  });

  it("renders a loading skeleton for the desktop list content", async () => {
    const scenario = createCrmScenario({
      db: createCrmDb({
        contacts: [buildContact()] as any,
      }),
      getListDelays: { contacts: 5_000 },
    });

    const { container } = render(
      <CrmTestProvider resource="contacts" scenario={scenario}>
        <DesktopContactListContentHarness />
      </CrmTestProvider>,
    );

    await waitFor(() => {
      expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
    });
  });

  it("renders the mobile error state when loading contacts fails", async () => {
    const scenario = createCrmScenario({
      db: createCrmDb({
        contacts: [buildContact()] as any,
      }),
      failGetListOnce: { contacts: "Error loading contacts" },
    });

    render(
      <CrmTestProvider resource="contacts" scenario={scenario}>
        <MobileContactListContentHarness />
      </CrmTestProvider>,
    );

    expect(await screen.findByText("Error loading contacts")).toBeVisible();
    expect(screen.getByRole("button", { name: /retry/i })).toBeVisible();
  });

  it("retries successfully in the mobile error state", async () => {
    const user = userEvent.setup();
    const scenario = createCrmScenario({
      db: createCrmDb({
        contacts: [
          buildContact({
            first_name: "Grace",
            id: 2,
            last_name: "Hopper",
            title: "Rear Admiral",
          }),
        ] as any,
      }),
      failGetListOnce: { contacts: "Error loading contacts" },
    });

    render(
      <CrmTestProvider resource="contacts" scenario={scenario}>
        <MobileContactListContentHarness />
      </CrmTestProvider>,
    );

    await user.click(
      await screen.findByRole("button", { name: /retry/i }),
    );

    expect(await screen.findByText("Grace Hopper")).toBeVisible();
    expect(screen.queryByText("Error loading contacts")).toBeNull();
  });
});
