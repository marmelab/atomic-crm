import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { buildCompany, buildContact, StoryWrapper } from "@/test/StoryWrapper";
import { CompanyShow } from "./CompanyShow";

// The mobile layout follows the window width (useIsMobile), so tests set the
// viewport instead of mocking the hook: a module mock is not reliably applied
// when another test file of the same browser session loaded the hook first.
const MOBILE = [375, 667] as const;

describe("CompanyShow on mobile", () => {
  beforeEach(async () => {
    await page.viewport(...MOBILE);
  });

  it("lists the company contacts, each linking to its contact page", async () => {
    const screen = await render(
      <StoryWrapper
        data={{
          companies: [buildCompany({ id: 1, nb_contacts: 2 })],
          contacts: [
            buildContact({ id: 1, company_id: 1, title: "CTO" }),
            buildContact({
              id: 2,
              company_id: 1,
              first_name: "Grace",
              last_name: "Hopper",
              title: "Admiral",
            }),
            buildContact({
              id: 3,
              company_id: null,
              first_name: "Alan",
              last_name: "Turing",
            }),
          ],
        }}
      >
        <CompanyShow resource="companies" id={1} />
      </StoryWrapper>,
    );

    await expect
      .element(screen.getByRole("heading", { name: "Contacts" }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("link", { name: /Ada Lovelace/ }))
      .toHaveAttribute("href", "/contacts/1/show");
    await expect
      .element(screen.getByRole("link", { name: /Grace Hopper/ }))
      .toHaveAttribute("href", "/contacts/2/show");
    await expect
      .element(screen.getByRole("link", { name: /Alan Turing/ }))
      .not.toBeInTheDocument();
  });

  it("hides the contacts block when the company has no contact", async () => {
    const screen = await render(
      <StoryWrapper
        data={{ companies: [buildCompany({ id: 1, nb_contacts: 0 })] }}
      >
        <CompanyShow resource="companies" id={1} />
      </StoryWrapper>,
    );

    await expect.element(screen.getByText("Acme")).toBeVisible();
    await expect
      .element(screen.getByRole("heading", { name: "Contacts" }))
      .not.toBeInTheDocument();
  });
});
