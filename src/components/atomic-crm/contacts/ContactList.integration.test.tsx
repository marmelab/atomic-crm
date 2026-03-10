import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

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

    const screen = await render(
      <CrmTestProvider resource="contacts" scenario={scenario}>
        <DesktopContactListHarness />
      </CrmTestProvider>,
    );

    await expect
      .element(screen.getByRole("heading", { name: "No contacts found" }))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("It seems your contact list is empty."))
      .toBeVisible();
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

    const screen = await render(
      <CrmTestProvider resource="contacts" scenario={scenario}>
        <DesktopContactListHarness />
      </CrmTestProvider>,
    );

    await expect.element(screen.getByText("Ada Lovelace")).toBeVisible();
    await expect.element(screen.getByText("Grace Hopper")).toBeVisible();
    await expect
      .element(screen.getByRole("heading", { name: "No contacts found" }))
      .not.toBeInTheDocument();
  });

  it("renders a loading skeleton for the desktop list content", async () => {
    const scenario = createCrmScenario({
      db: createCrmDb({
        contacts: [buildContact()] as any,
      }),
      getListDelays: { contacts: 5_000 },
    });

    const screen = await render(
      <CrmTestProvider resource="contacts" scenario={scenario}>
        <DesktopContactListContentHarness />
      </CrmTestProvider>,
    );

    await expect
      .poll(() => screen.container.querySelector('[data-slot="skeleton"]'))
      .not.toBeNull();
  });

  it("renders the mobile error state when loading contacts fails", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    try {
      const scenario = createCrmScenario({
        db: createCrmDb({
          contacts: [buildContact()] as any,
        }),
        failGetListOnce: { contacts: "Error loading contacts" },
      });

      const screen = await render(
        <CrmTestProvider resource="contacts" scenario={scenario}>
          <MobileContactListContentHarness />
        </CrmTestProvider>,
      );

      await expect
        .element(screen.getByText("Error loading contacts"))
        .toBeVisible();
      await expect
        .element(screen.getByRole("button", { name: /retry/i }))
        .toBeVisible();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("retries successfully in the mobile error state", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    try {
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

      const screen = await render(
        <CrmTestProvider resource="contacts" scenario={scenario}>
          <MobileContactListContentHarness />
        </CrmTestProvider>,
      );

      await screen.getByRole("button", { name: /retry/i }).click();

      await expect.element(screen.getByText("Grace Hopper")).toBeVisible();
      await expect
        .element(screen.getByText("Error loading contacts"))
        .not.toBeInTheDocument();
    } finally {
      consoleError.mockRestore();
    }
  });
});
