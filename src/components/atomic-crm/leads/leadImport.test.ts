import { describe, expect, it } from "vitest";

import {
  domainFromEmail,
  domainFromWebsite,
  mapLeadRecord,
  mergeReports,
  normalizePhone,
  prepareLeadRecords,
  rejectsToCsv,
} from "./leadImport";

describe("normalizePhone", () => {
  it.each([
    ["98765 43210", "+919876543210"],
    ["098765-43210", "+919876543210"],
    ["91 9876543210", "+919876543210"],
    ["+91 98765 43210", "+919876543210"],
    ["0091 9876543210", "+919876543210"],
    ["+1 (415) 555-0100", "+14155550100"],
  ])("normalizes %s to %s", (raw, expected) => {
    expect(normalizePhone(raw)).toEqual({ phone: expected });
  });

  it.each(["12345", "5876543210", "abc-def", "+0 123 456 789", ""])(
    "rejects %s",
    (raw) => {
      expect(normalizePhone(raw)).toHaveProperty("error");
    },
  );
});

describe("company domain", () => {
  it("reads the host of a website", () => {
    expect(domainFromWebsite("https://www.Acme.com/about")).toBe("acme.com");
    expect(domainFromWebsite("acme.co.in")).toBe("acme.co.in");
    expect(domainFromWebsite("not a site")).toBe("");
  });

  it("ignores free mail providers", () => {
    expect(domainFromEmail("ravi@acme.com")).toBe("acme.com");
    expect(domainFromEmail("ravi@gmail.com")).toBe("");
  });
});

describe("mapLeadRecord", () => {
  it("maps common header spellings and normalizes the values", () => {
    const result = mapLeadRecord(
      {
        "Business Name": "Acme Foods",
        "Contact Name": "Ravi Kumar Shah",
        Mobile: "98765 43210",
        Email: " Ravi@AcmeFoods.in ",
        Industry: "FMCG",
        "Pitch Script": "Ask about distribution",
      },
      3,
    );

    expect(result).toEqual({
      lead: {
        row: 3,
        company_name: "Acme Foods",
        first_name: "Ravi",
        last_name: "Kumar Shah",
        title: "",
        phone: "+919876543210",
        email: "ravi@acmefoods.in",
        industry: "FMCG",
        pitch: "Ask about distribution",
        domain: "acmefoods.in",
      },
    });
  });

  it.each([
    [{ name: "Ravi", phone: "9876543210" }, "missing company name"],
    [{ company: "Acme", phone: "9876543210" }, "missing contact name"],
    [{ company: "Acme", name: "Ravi" }, "missing phone and email"],
    [{ company: "Acme", name: "Ravi", phone: "12" }, "invalid phone: 12"],
    [{ company: "Acme", name: "Ravi", email: "ravi@" }, "invalid email: ravi@"],
  ])("rejects %j with %s", (record, reason) => {
    expect(mapLeadRecord(record, 1)).toEqual({
      invalid: { row: 1, status: "invalid", reason },
    });
  });
});

describe("reports", () => {
  const records = [
    { company: "Acme", name: "Ravi", phone: "9876543210" },
    { company: "Beta", name: "Anu", phone: "1" },
    { company: "Acme, Inc", name: 'Dev "D"', phone: "9876543210" },
  ];

  it("merges client rejects into the server report in row order", () => {
    const { leads, invalid } = prepareLeadRecords(records);
    expect(leads.map((lead) => lead.row)).toEqual([1, 3]);

    const merged = mergeReports(
      {
        batch_id: 1,
        created: 1,
        duplicates: 1,
        invalid: 0,
        rows: [
          { row: 1, status: "created", contact_id: 10 },
          { row: 3, status: "duplicate", reason: "duplicate in file" },
        ],
      },
      invalid,
    );

    expect(merged.invalid).toBe(1);
    expect(merged.rows.map((row) => [row.row, row.status])).toEqual([
      [1, "created"],
      [2, "invalid"],
      [3, "duplicate"],
    ]);
  });

  it("exports only the rejected rows, CSV-escaped, with their reason", () => {
    const csv = rejectsToCsv(
      [
        { row: 1, status: "created" },
        { row: 2, status: "invalid", reason: "invalid phone: 1" },
        { row: 3, status: "duplicate", reason: "duplicate in file" },
      ],
      records,
    );

    expect(csv.split("\n")).toEqual([
      "row,status,reason,company,name,phone",
      "2,invalid,invalid phone: 1,Beta,Anu,1",
      '3,duplicate,duplicate in file,"Acme, Inc","Dev ""D""",9876543210',
    ]);
  });
});
