import { describe, expect, it } from "vitest";

import type {
  Company,
  Contact,
  Sale,
  Tag,
} from "@/components/atomic-crm/types";

import { buildContactsExportRows } from "./contactExport";

type ContactExportRecord = Contact & {
  company_name?: string;
  email_fts?: string;
  phone_fts?: string;
};

const buildContact = (overrides: Partial<ContactExportRecord> = {}): ContactExportRecord => ({
  background: "",
  company_id: null,
  company_name: undefined,
  email_jsonb: [{ email: "ada@example.com", type: "Work" }],
  email_fts: "ada@example.com",
  first_name: "Ada",
  first_seen: "2025-01-01T09:00:00.000Z",
  gender: "female",
  has_newsletter: false,
  id: 1,
  last_name: "Lovelace",
  last_seen: "2025-01-02T10:00:00.000Z",
  linkedin_url: null,
  nb_tasks: 0,
  phone_jsonb: [{ number: "+48 123 456 789", type: "Work" }],
  phone_fts: "+48 123 456 789",
  sales_id: 1,
  status: "warm",
  tags: [],
  title: "CTO",
  ...overrides,
});

describe("buildContactsExportRows", () => {
  it("ignores missing related records instead of crashing", () => {
    const contact = buildContact({
      company_id: 10,
      company_name: "OpenAI",
      sales_id: null,
      tags: [1, 2],
    });

    const [row] = buildContactsExportRows([contact], {
      companies: {},
      sales: {},
      tags: {
        "1": {
          color: "blue",
          id: 1,
          name: "VIP",
        } satisfies Tag,
      },
    });

    expect(row.company).toBe("OpenAI");
    expect(row.sales).toBeUndefined();
    expect(row.tags).toBe("VIP");
    expect(row.email_work).toBe("ada@example.com");
    expect(row.phone_work).toBe("+48 123 456 789");
    expect(row).not.toHaveProperty("email_fts");
    expect(row).not.toHaveProperty("phone_fts");
  });

  it("exports related company and sales names when they exist", () => {
    const contact = buildContact({
      company_id: 10,
      sales_id: 20,
      tags: [1],
    });

    const [row] = buildContactsExportRows([contact], {
      companies: {
        "10": {
          id: 10,
          name: "Acme",
        } as Company,
      },
      sales: {
        "20": {
          administrator: false,
          email: "grace@example.com",
          first_name: "Grace",
          id: 20,
          last_name: "Hopper",
          user_id: "20",
        } satisfies Sale,
      },
      tags: {
        "1": {
          color: "blue",
          id: 1,
          name: "Priority",
        } satisfies Tag,
      },
    });

    expect(row.company).toBe("Acme");
    expect(row.sales).toBe("Grace Hopper");
    expect(row.tags).toBe("Priority");
  });
});
