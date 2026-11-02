import fakeRestDataProvider from "ra-data-fakerest";
import { describe, expect, it } from "vitest";

import { importLeadsInMemory } from "./importLeadsInMemory";
import type { LeadImportRow } from "./leadImport";

const lead = (row: number, overrides: Partial<LeadImportRow> = {}) => ({
  row,
  company_name: "Acme Foods",
  first_name: "Ravi",
  last_name: "Kumar",
  title: "",
  phone: `+9198765432${String(row).padStart(2, "0")}`,
  email: "",
  industry: "FMCG",
  pitch: "Ask about distribution",
  domain: "",
  ...overrides,
});

const setup = () =>
  fakeRestDataProvider({
    contacts: [
      {
        id: 1,
        first_name: "Existing",
        phone_e164: "+919999999999",
        email_jsonb: [{ email: "old@acme.com", type: "Work" }],
      },
    ],
    companies: [{ id: 5, name: "Beta Traders", website: "https://beta.in" }],
    import_batches: [],
    deals: [],
  });

describe("importLeadsInMemory", () => {
  it("creates new leads in the pool and records the batch", async () => {
    const dataProvider = setup();

    const result = await importLeadsInMemory(
      dataProvider,
      "leads.csv",
      [lead(1), lead(2)],
      3,
    );

    expect(result).toMatchObject({ created: 2, duplicates: 0 });
    const { data: contacts } = await dataProvider.getList("contacts", {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
      filter: { lead_stage: "new" },
    });
    expect(contacts).toHaveLength(2);
    expect(contacts[0]).toMatchObject({
      phone_e164: "+919876543201",
      whatsapp_number: "+919876543201",
      is_primary: true,
      import_batch_id: result.batch_id,
    });
    expect(contacts[1]).toMatchObject({ is_primary: false });
    const { data: deals } = await dataProvider.getList("deals", {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
      filter: {},
    });
    expect(deals).toHaveLength(1);
    expect(deals[0]).toMatchObject({
      name: "Acme Foods",
      stage: "cold",
      amount: 0,
    });
    expect(deals[0].contact_ids).toEqual(contacts.map((contact) => contact.id));
    const { data: batch } = await dataProvider.getOne("import_batches", {
      id: result.batch_id!,
    });
    expect(batch).toMatchObject({
      file_name: "leads.csv",
      created_by: 3,
      total_rows: 2,
      created_count: 2,
    });
  });

  it("flags duplicates by phone or email, in the CRM and inside the file", async () => {
    const dataProvider = setup();

    const result = await importLeadsInMemory(dataProvider, "leads.csv", [
      lead(1, { phone: "+919999999999" }),
      lead(2, { phone: "", email: "old@acme.com" }),
      lead(3),
      lead(4, { phone: "+919876543203" }),
    ]);

    expect(result.rows.map((row) => [row.row, row.status, row.reason])).toEqual(
      [
        [1, "duplicate", "matches an existing lead"],
        [2, "duplicate", "matches an existing lead"],
        [3, "created", undefined],
        [4, "duplicate", "duplicate in file"],
      ],
    );
  });

  it("reuses a company with the same domain or name", async () => {
    const dataProvider = setup();

    await importLeadsInMemory(dataProvider, "leads.csv", [
      lead(1, { company_name: "Beta Trading Co", domain: "beta.in" }),
      lead(2, { company_name: "beta traders" }),
      lead(3, { company_name: "Gamma" }),
    ]);

    const { data: companies } = await dataProvider.getList("companies", {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
      filter: {},
    });
    expect(companies.map((company) => company.name)).toEqual([
      "Beta Traders",
      "Gamma",
    ]);
    const { data: deals } = await dataProvider.getList("deals", {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
      filter: {},
    });
    expect(deals).toHaveLength(2);
    const beta = companies.find((company) => company.name === "Beta Traders");
    const betaDeal = deals.find((deal) => deal.company_id === beta?.id);
    expect(betaDeal?.contact_ids).toHaveLength(2);
    expect(betaDeal?.stage).toBe("cold");
  });
});
