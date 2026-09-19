import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { MemoryRouter } from "react-router";
import { memoryStore } from "ra-core";

import { CRM } from "@/components/atomic-crm/root/CRM";
import { testI18nProvider } from "@/components/atomic-crm/providers/commons/i18nProvider";
import { createDataProvider } from "@/components/atomic-crm/providers/fakerest";
import {
  buildContact,
  createCrmDb,
  createTestAuthProvider,
} from "@/test/StoryWrapper";

// A client's name belongs on their page once.
//
// The framework's default page title was the record representation — for
// an Enrollment, its id, so production showed "Client #63" above the
// person's own name. Replacing that title with the name fixed the wrong
// half: the body already opened with their name as a link to their
// Contact, with the programme and email beneath, so every client page
// then showed the same person twice, once plain and once useful.
//
// Synthetic name, chosen so it cannot collide with any other text.
const PERSON = "Zeta Nameproof";

const buildCrm = () =>
  createDataProvider({
    db: createCrmDb({
      contacts: [
        buildContact({ id: 1, first_name: "Zeta", last_name: "Nameproof" }),
      ],
      offers: [
        {
          id: 1,
          name: "The Living Example",
          type: "individual",
          is_active: true,
          duration: "4 months",
          current_price: 4000,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        } as never,
      ],
      deals: [
        {
          id: 1,
          name: "Zeta",
          contact_id: 1,
          offer_id: 1,
          stage: "won",
          outcome: null,
          archived_at: null,
          index: 0,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        } as never,
      ],
      enrollments: [
        {
          id: 1,
          opportunity_id: 1,
          status: "active",
          onboarding_tracking: "tracked",
          start_date: "2026-01-05",
          end_date: null,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        } as never,
      ],
    } as never),
    silent: true,
  });

describe("ClientShow — the person's name", () => {
  it("appears exactly once, as the link to their Contact", async () => {
    // Arrange
    await page.viewport(1280, 900);

    // Act
    const screen = await render(
      <MemoryRouter initialEntries={["/enrollments/1/show"]}>
        <CRM
          dataProvider={buildCrm()}
          authProvider={createTestAuthProvider()}
          i18nProvider={testI18nProvider}
          store={memoryStore()}
          disableTelemetry
        />
      </MemoryRouter>,
    );
    await expect.element(screen.getByText(PERSON).first()).toBeInTheDocument();

    // Assert — once, and it is the one that goes somewhere.
    const occurrences =
      (screen.container.textContent ?? "").split(PERSON).length - 1;
    expect(occurrences).toBe(1);

    const link = screen.container.querySelector(`a[href*="/contacts/1/show"]`);
    expect(link?.textContent).toContain(PERSON);
  });
});
