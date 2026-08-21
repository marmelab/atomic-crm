import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { useState } from "react";

import { createDataProvider } from "@/components/atomic-crm/providers/fakerest";
import { createCrmDb, StoryWrapper } from "@/test/StoryWrapper";
import type { DataProvider } from "ra-core";
import { AllResources, SingleResource } from "./DataImportButton.stories";
import type { ImportRow, ProcessImportBatch } from "./types";
import { useCompanyImport } from "./useCompanyImport";
import { useDealImport } from "./useDealImport";

const mockIsMobile = vi.hoisted(() => vi.fn(() => false));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: mockIsMobile }));

const listAll = (dataProvider: DataProvider, resource: string) =>
  dataProvider.getList(resource, {
    filter: {},
    pagination: { page: 1, perPage: 25 },
    sort: { field: "id", order: "ASC" },
  });

/** Imports one batch on click, so a test controls when the import starts. */
const ImportHarness = ({
  rows,
  useImport,
}: {
  rows: ImportRow[];
  useImport: () => ProcessImportBatch;
}) => {
  const processBatch = useImport();
  const [status, setStatus] = useState("ready");
  return (
    <>
      <button
        onClick={() => {
          setStatus("running");
          processBatch(rows).then(
            () => setStatus("imported"),
            () => setStatus("failed"),
          );
        }}
      >
        run import
      </button>
      <span>{status}</span>
    </>
  );
};

/** Renders the harness on its own data provider, so each test owns its records. */
const renderImport = async (
  useImport: () => ProcessImportBatch,
  rows: ImportRow[],
) => {
  const dataProvider = createDataProvider({
    db: createCrmDb(),
    latency: 0,
    silent: true,
  });
  const screen = await render(
    <StoryWrapper dataProvider={dataProvider}>
      <ImportHarness useImport={useImport} rows={rows} />
    </StoryWrapper>,
  );
  return { dataProvider, screen };
};

describe("DataImportButton", () => {
  beforeEach(() => {
    mockIsMobile.mockReturnValue(false);
  });

  it("offers every importable resource in the dialog", async () => {
    const screen = await render(<AllResources />);

    await screen.getByRole("button", { name: "Import data" }).click();

    await expect
      .element(screen.getByRole("heading", { name: "Import data" }))
      .toBeVisible();

    await screen.getByLabelText("Resource").click();
    const options = screen.getByRole("listbox");

    await expect.element(options.getByText("Contacts")).toBeVisible();
    await expect.element(options.getByText("Companies")).toBeVisible();
    await expect.element(options.getByText("Deals")).toBeVisible();
  });

  it.each([
    ["contacts", "Import contacts"],
    ["companies", "Import companies"],
    ["deals", "Import deals"],
  ] as const)(
    "imports %s from a dialog with no resource to pick",
    async (resource, heading) => {
      const screen = await render(<SingleResource resource={resource} />);

      await screen.getByRole("button", { name: "Import CSV" }).click();

      await expect
        .element(screen.getByRole("heading", { name: heading }))
        .toBeVisible();
      await expect
        .element(screen.getByLabelText("Resource"))
        .not.toBeInTheDocument();
    },
  );

  it("offers the sample CSV of the imported resource", async () => {
    const screen = await render(<SingleResource resource="deals" />);

    await screen.getByRole("button", { name: "Import CSV" }).click();

    await expect
      .element(screen.getByRole("link", { name: "Download CSV sample" }))
      .toHaveAttribute("download", "crm_deals_sample.csv");
  });

  it("imports companies, mapping sector labels and numeric columns", async () => {
    const { dataProvider, screen } = await renderImport(useCompanyImport, [
      {
        name: "Acme",
        sector: "Information Technology",
        size: 50,
        city: "New York",
        website: "https://acme.example",
      },
      { name: "Globex", sector: "Not a sector", size: null, city: null },
    ]);

    await screen.getByRole("button", { name: "run import" }).click();
    await expect.element(screen.getByText("imported")).toBeVisible();

    const { data: companies } = await listAll(dataProvider, "companies");
    expect(companies).toHaveLength(2);
    expect(companies[0]).toMatchObject({
      city: "New York",
      name: "Acme",
      sector: "information-technology",
      // 50 employees falls in the "50-249 employees" bucket
      size: 250,
      website: "https://acme.example",
    });
    // An unknown sector is dropped rather than stored as a free-text value
    expect(companies[1].sector).toBeUndefined();
    expect(companies[1].size).toBeUndefined();
  });

  it("coerces an arbitrary company size into a renderable bucket", async () => {
    const { dataProvider, screen } = await renderImport(useCompanyImport, [
      { name: "Acme", size: 42 },
    ]);

    await screen.getByRole("button", { name: "run import" }).click();
    await expect.element(screen.getByText("imported")).toBeVisible();

    const { data: companies } = await listAll(dataProvider, "companies");
    // 42 employees is not a bucket id; it belongs to "10-49 employees"
    expect(companies[0].size).toBe(50);
  });

  it("hides a resource the running app does not register", async () => {
    // The mobile app has no deals screens, so importing deals would create
    // records the user could never see.
    mockIsMobile.mockReturnValue(true);
    const screen = await render(<AllResources />);

    await screen.getByRole("button", { name: "Import data" }).click();
    await screen.getByLabelText("Resource").click();
    const options = screen.getByRole("listbox");

    await expect.element(options.getByText("Contacts")).toBeVisible();
    await expect.element(options.getByText("Deals")).not.toBeInTheDocument();
  });

  it("renders nothing for a resource the running app does not register", async () => {
    mockIsMobile.mockReturnValue(true);
    const screen = await render(<SingleResource resource="deals" />);

    await expect
      .element(screen.getByRole("button", { name: "Import CSV" }))
      .not.toBeInTheDocument();
  });

  it("imports deals, reusing one company and defaulting a missing stage", async () => {
    const { dataProvider, screen } = await renderImport(useDealImport, [
      {
        name: "New website",
        company: "Acme",
        category: "Website design",
        stage: "Proposal Sent",
        amount: "12000",
        expected_closing_date: "2026-09-30",
      },
      { name: "Print campaign", company: "Acme", stage: null },
    ]);

    await screen.getByRole("button", { name: "run import" }).click();
    await expect.element(screen.getByText("imported")).toBeVisible();

    const { data: companies } = await listAll(dataProvider, "companies");
    expect(companies).toHaveLength(1);
    expect(companies[0].name).toBe("Acme");

    const { data: deals } = await listAll(dataProvider, "deals");
    expect(deals).toHaveLength(2);
    expect(deals[0]).toMatchObject({
      amount: 12000,
      category: "website-design",
      company_id: companies[0].id,
      name: "New website",
      stage: "proposal-sent",
    });
    expect(deals[0].expected_closing_date).toBe("2026-09-30T00:00:00.000Z");
    // Both rows name the same company, which is created once and shared
    expect(deals[1].company_id).toBe(companies[0].id);
    // stage is required, so an empty cell falls back to the first stage
    expect(deals[1].stage).toBe("opportunity");
  });
});
