import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { memoryStore } from "ra-core";
import { MemoryRouter } from "react-router";

import { CoreAdminContext } from "ra-core";
import { WaitlistSection } from "./WaitlistSection";
import { createDataProvider } from "../providers/fakerest/dataProvider";
import {
  createCrmDb,
  buildContact,
  createTestAuthProvider,
} from "@/test/StoryWrapper";
import { testI18nProvider } from "../providers/commons/i18nProvider";
import type { WaitlistEntryRow } from "./useWaitlistEntries";

// Pre-Gmail safety: the bulk action prepares invitations but sends nothing.
// Until delivery exists, production must not offer an action whose plain
// meaning is "these people have been invited".

const rows: WaitlistEntryRow[] = [
  {
    entryId: 1,
    contactId: 1,
    name: "Wren Halloway",
    email: "wren@example.invalid",
    status: "waiting",
    joinedAt: "2026-08-01T00:00:00.000Z",
  } as WaitlistEntryRow,
  {
    entryId: 2,
    contactId: 2,
    name: "Rowan Vance",
    email: "rowan@example.invalid",
    status: "waiting",
    joinedAt: "2026-08-02T00:00:00.000Z",
  } as WaitlistEntryRow,
];

const renderSection = async (enableBulkInvite?: boolean) => {
  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: [buildContact({ id: 1 }), buildContact({ id: 2 })],
      offers: [
        {
          id: 1,
          name: "The Living Example",
          type: "individual",
          duration: "4m",
          current_price: 4000,
          is_active: true,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      waitlist_entries: [],
      waitlist_invitation_batches: [],
      waitlist_invitations: [],
    } as any),
    silent: true,
    latency: 0,
  });

  await page.viewport(1280, 900);
  return render(
    <MemoryRouter>
      <CoreAdminContext
        dataProvider={dataProvider}
        authProvider={createTestAuthProvider()}
        i18nProvider={testI18nProvider}
        store={memoryStore()}
      >
        <WaitlistSection
          entries={rows}
          offerId={1}
          offerName="The Living Example"
          cohortId={null}
          {...(enableBulkInvite === undefined ? {} : { enableBulkInvite })}
        />
      </CoreAdminContext>
    </MemoryRouter>,
  );
};

describe("bulk invite gating before Gmail delivery exists", () => {
  it("offers no bulk invite action in production, so nobody can mistake prepared for sent", async () => {
    // Production default: VITE_ENABLE_WAITLIST_INVITE_DELIVERY is unset.
    const screen = await renderSection(false);

    const text = screen.container.textContent ?? "";
    expect(text).not.toContain("Invite to Book");
    expect(text).not.toContain("Select all");
    // No selection affordance at all.
    expect(
      screen.container.ownerDocument.querySelectorAll('[role="checkbox"]')
        .length,
    ).toBe(0);
    // The waitlist itself still renders normally.
    expect(text).toContain("Wren Halloway");
  });

  it("exposes the bulk action once delivery is enabled, and says plainly that nothing is sent yet", async () => {
    const screen = await renderSection(true);

    await expect.element(screen.getByText("Select all")).toBeInTheDocument();
    await screen.getByText("Select all").click();
    await screen.getByRole("button", { name: /Invite to Book/ }).click();

    const dialog =
      screen.container.ownerDocument.querySelector('[role="dialog"]')
        ?.textContent ?? "";
    // The review step never implies delivery.
    expect(dialog).toContain("No email is sent yet");
  });
});
