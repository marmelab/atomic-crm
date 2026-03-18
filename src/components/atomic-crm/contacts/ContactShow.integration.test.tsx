import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import {
  buildContact,
  createCrmDb,
  createCrmScenario,
  CrmTestProvider,
  MobileContactShowHarness,
} from "@/test/browser/atomic-crm/crmUiHarness";

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => true,
}));

describe("Contact show integration", () => {
  it("renders a safe zero-task label before nb_tasks is available", async () => {
    const scenario = createCrmScenario({
      db: createCrmDb({
        contacts: [
          buildContact({
            first_name: "Jane",
            id: 8,
            last_name: "Smith",
            nb_tasks: undefined,
          }),
        ] as any,
      }),
    });

    const screen = await render(
      <CrmTestProvider
        initialEntries={["/contacts/8/show"]}
        resource="contacts"
        scenario={scenario}
      >
        <MobileContactShowHarness />
      </CrmTestProvider>,
    );

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
});
