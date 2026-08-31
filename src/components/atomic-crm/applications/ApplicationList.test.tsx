import React from "react";
import { render } from "vitest-browser-react";
import { CoreAdminContext } from "ra-core";
import fakeDataProvider from "ra-data-fakerest";

import { ApplicationList } from "./ApplicationList";

// Two offers (one individual, one group with two cohorts) and one
// application per cohort/offer, so a wrong-section assignment shows up as a
// visible test failure rather than needing to inspect grouping internals
// (Runtime + Visual Consistency slice, §5/§12: "application records appear
// in only the appropriate section").
const offers = [
  { id: 1, name: "The Living Example", type: "individual" },
  { id: 2, name: "Growing Yourself Up", type: "group" },
];

const cohorts = [
  { id: 10, offer_id: 2, name: "September GYU Cohort" },
  { id: 11, offer_id: 2, name: "November GYU Cohort" },
];

const contacts = [
  { id: 100, first_name: "Rosalind", last_name: "Park" },
  { id: 101, first_name: "Priya", last_name: "Nair" },
  { id: 102, first_name: "Jordan", last_name: "Lee" },
];

const deals = [
  { id: 200, contact_id: 100, offer_id: 1, cohort_id: null, name: "Rosalind" },
  { id: 201, contact_id: 101, offer_id: 2, cohort_id: 10, name: "Priya" },
  { id: 202, contact_id: 102, offer_id: 2, cohort_id: 11, name: "Jordan" },
];

const applications = [
  {
    id: 300,
    opportunity_id: 200,
    status: "pending",
    submitted_at: "2026-08-01T10:00:00.000Z",
  },
  {
    id: 301,
    opportunity_id: 201,
    status: "pending",
    submitted_at: "2026-08-02T10:00:00.000Z",
  },
  {
    id: 302,
    opportunity_id: 202,
    status: "pending",
    submitted_at: "2026-08-03T10:00:00.000Z",
  },
];

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <CoreAdminContext
    dataProvider={fakeDataProvider({
      applications,
      deals,
      offers,
      cohorts,
      contacts,
    })}
    i18nProvider={{
      translate: (key, options) => {
        if (typeof options?.name === "string") {
          return `1:1 — ${options.name}`;
        }
        if (typeof options?._ === "string") {
          return options._;
        }
        return key;
      },
      changeLocale: () => Promise.resolve(),
      getLocale: () => "en",
    }}
  >
    {children}
  </CoreAdminContext>
);

describe("ApplicationList", () => {
  it("separates the individual (1:1) offer into its own section", async () => {
    const screen = await render(<ApplicationList />, { wrapper: Wrapper });
    await expect
      .element(screen.getByText("1:1 — The Living Example"))
      .toBeInTheDocument();
    await expect.element(screen.getByText("Rosalind Park")).toBeInTheDocument();
  });

  it("groups group-offer applications under their own Cohort, not the individual offer", async () => {
    const screen = await render(<ApplicationList />, { wrapper: Wrapper });
    await expect
      .element(screen.getByText("September GYU Cohort"))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("November GYU Cohort"))
      .toBeInTheDocument();
    await expect.element(screen.getByText("Priya Nair")).toBeInTheDocument();
    await expect.element(screen.getByText("Jordan Lee")).toBeInTheDocument();
  });

  it("does not show a September Cohort applicant under November Cohort", async () => {
    const screen = await render(<ApplicationList />, { wrapper: Wrapper });
    const { container } = screen;
    // Wait for the async data load (deals/offers/cohorts/contacts) to
    // resolve before inspecting the DOM structure below.
    await expect
      .element(screen.getByText("November GYU Cohort"))
      .toBeInTheDocument();

    const sections = [...container.querySelectorAll("h2")];
    const novemberSection = sections
      .find((el) => el.textContent === "November GYU Cohort")
      ?.closest("div");
    expect(novemberSection?.textContent).not.toContain("Priya Nair");

    const septemberSection = sections
      .find((el) => el.textContent === "September GYU Cohort")
      ?.closest("div");
    expect(septemberSection?.textContent).not.toContain("Jordan Lee");
  });

  it("shows the offer group label above its cohorts", async () => {
    const screen = await render(<ApplicationList />, { wrapper: Wrapper });
    await expect
      .element(screen.getByText("Growing Yourself Up"))
      .toBeInTheDocument();
  });
});
