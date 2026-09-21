// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  addNoteToContact,
  findActiveSaleByEmail,
  getOrCreateCompanyFromDomain,
  getOrCreateContactFromEmailInfo,
} from "./addNoteToContact";

const mockFrom = vi.hoisted(() => vi.fn());

vi.mock("../_shared/supabaseAdmin.ts", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

const secondaryLookupResult = (
  rows: unknown[],
  error: { message: string } | null = null,
) => ({
  neq: () => ({
    order: () => ({
      limit: () => Promise.resolve({ data: error ? null : rows, error }),
    }),
  }),
});

const primaryLookupMiss = {
  select: () => ({
    eq: () => ({
      neq: () => ({
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
      }),
    }),
  }),
};

describe("addNoteToContact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterAll(() => {
    vi.resetAllMocks();
  });
  describe("getOrCreateCompanyFromDomain", () => {
    it("returns the existing company when it already exists in the database", async () => {
      const existingCompany = {
        id: 1,
        name: "Acme",
        website: "https://acme.com",
        sales_id: 42,
      };
      mockFrom.mockReturnValue({
        select: () => ({
          or: () => ({
            maybeSingle: () =>
              Promise.resolve({ data: existingCompany, error: null }),
          }),
        }),
      });

      const result = await getOrCreateCompanyFromDomain({
        domain: "acme.com",
        salesId: 42,
        companyName: "Acme",
        website: "https://acme.com",
      });

      expect(result).toEqual(existingCompany);
      expect(mockFrom).toHaveBeenCalledWith("companies");
    });

    it("throws when fetching the company fails", async () => {
      mockFrom.mockReturnValue({
        select: () => ({
          or: () => ({
            maybeSingle: () =>
              Promise.resolve({ data: null, error: { message: "DB error" } }),
          }),
        }),
      });

      await expect(
        getOrCreateCompanyFromDomain({
          domain: "acme.com",
          salesId: 42,
          companyName: "Acme",
          website: "https://acme.com",
        }),
      ).rejects.toThrow(
        "Could not fetch companies from database, name: acme.com, error: DB error",
      );
    });

    it("returns null for a known mail provider domain without creating a company", async () => {
      const result = await getOrCreateCompanyFromDomain({
        domain: "gmail.com",
        salesId: 42,
        companyName: "Gmail",
        website: "https://gmail.com",
      });

      expect(result).toBeNull();
      // No database calls should be made for mail providers
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it("creates and returns a new company when it does not exist and domain is not a mail provider", async () => {
      const newCompany = {
        id: 2,
        name: "Acme",
        website: "https://acme.com",
        sales_id: 42,
      };
      mockFrom
        .mockReturnValueOnce({
          // first call: fetch
          select: () => ({
            or: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          // second call: insert
          insert: () => ({
            select: () => Promise.resolve({ data: [newCompany], error: null }),
          }),
        });

      const result = await getOrCreateCompanyFromDomain({
        domain: "acme.com",
        salesId: 42,
        companyName: "Acme",
        website: "https://acme.com",
      });

      expect(result).toEqual(newCompany);
      expect(mockFrom).toHaveBeenCalledTimes(2);
      expect(mockFrom).toHaveBeenNthCalledWith(2, "companies");
    });

    it("throws when creating the company fails", async () => {
      mockFrom
        .mockReturnValueOnce({
          select: () => ({
            or: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          insert: () => ({
            select: () =>
              Promise.resolve({
                data: null,
                error: { message: "Insert failed" },
              }),
          }),
        });

      await expect(
        getOrCreateCompanyFromDomain({
          domain: "acme.com",
          salesId: 42,
          companyName: "Acme",
          website: "https://acme.com",
        }),
      ).rejects.toThrow(
        "Could not create company in database, domain: acme.com, error: Insert failed",
      );
    });
  });

  describe("getOrCreateContactFromEmailInfo", () => {
    const contactParams = {
      email: "alice@acme.com",
      firstName: "Alice",
      lastName: "Smith",
      salesId: 42,
      domain: "acme.com",
      companyName: "Acme",
      website: "https://acme.com",
    };

    it("returns the existing contact when it already exists in the database", async () => {
      const existingContact = {
        id: 10,
        first_name: "Alice",
        last_name: "Smith",
      };
      mockFrom.mockReturnValue({
        select: () => ({
          contains: () => ({
            maybeSingle: () =>
              Promise.resolve({ data: existingContact, error: null }),
          }),
        }),
      });

      const result = await getOrCreateContactFromEmailInfo(contactParams);

      expect(result).toEqual(existingContact);
      expect(mockFrom).toHaveBeenCalledWith("contacts");
    });

    it("throws when fetching the contact fails", async () => {
      mockFrom.mockReturnValue({
        select: () => ({
          contains: () => ({
            maybeSingle: () =>
              Promise.resolve({ data: null, error: { message: "DB error" } }),
          }),
        }),
      });

      await expect(
        getOrCreateContactFromEmailInfo(contactParams),
      ).rejects.toThrow(
        "Could not fetch contact from database, email: alice@acme.com, error: DB error",
      );
    });

    it("creates and returns a new contact with the associated company", async () => {
      const newContact = {
        id: 11,
        first_name: "Alice",
        last_name: "Smith",
        company_id: 1,
      };
      const existingCompany = {
        id: 1,
        name: "Acme",
        website: "https://acme.com",
        sales_id: 42,
      };

      mockFrom
        .mockReturnValueOnce({
          // 1st call: fetch contact → not found
          select: () => ({
            contains: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          // 2nd call: fetch company → found
          select: () => ({
            or: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: existingCompany, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          // 3rd call: insert contact
          insert: () => ({
            select: () => Promise.resolve({ data: [newContact], error: null }),
          }),
        });

      const result = await getOrCreateContactFromEmailInfo(contactParams);

      expect(result).toEqual(newContact);
      expect(mockFrom).toHaveBeenCalledTimes(3);
    });

    it("creates a contact with null company_id when domain is a mail provider", async () => {
      const newContact = {
        id: 12,
        first_name: "Alice",
        last_name: "Smith",
        company_id: null,
      };

      mockFrom
        .mockReturnValueOnce({
          // 1st call: fetch contact → not found
          select: () => ({
            contains: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          // 2nd call: insert contact (with null company_id)
          insert: () => ({
            select: () => Promise.resolve({ data: [newContact], error: null }),
          }),
        });

      const result = await getOrCreateContactFromEmailInfo({
        ...contactParams,
        email: "alice@gmail.com",
        domain: "gmail.com",
        companyName: "Gmail",
        website: "https://gmail.com",
      });

      expect(result).toEqual(newContact);
      // Only 2 froms: contacts fetch, contacts insert (no company fetch/insert for mail provider)
      expect(mockFrom).toHaveBeenCalledTimes(2);
    });

    it("throws when creating the contact fails", async () => {
      const existingCompany = {
        id: 1,
        name: "Acme",
        website: "https://acme.com",
        sales_id: 42,
      };

      mockFrom
        .mockReturnValueOnce({
          select: () => ({
            contains: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: () => ({
            or: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: existingCompany, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          insert: () => ({
            select: () =>
              Promise.resolve({
                data: null,
                error: { message: "Insert failed" },
              }),
          }),
        });

      await expect(
        getOrCreateContactFromEmailInfo(contactParams),
      ).rejects.toThrow(
        "Could not create contact in database, email: alice@acme.com, error: Insert failed",
      );
    });
  });

  describe("findActiveSaleByEmail", () => {
    it("returns the active sale whose primary email matches the sender", async () => {
      const salesRecord = { id: 1, email: "sales@company.com" };
      mockFrom.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            neq: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: salesRecord, error: null }),
            }),
          }),
        }),
      });

      const result = await findActiveSaleByEmail("sales@company.com");

      expect(result.data).toEqual(salesRecord);
      expect(mockFrom).toHaveBeenCalledTimes(1);
    });

    it("looks up the secondary emails when no primary email matches", async () => {
      const salesRecord = {
        id: 1,
        email: "sales@company.com",
        secondary_emails: ["perso@gmail.com"],
      };
      const contains = vi
        .fn()
        .mockReturnValue(secondaryLookupResult([salesRecord]));

      mockFrom
        .mockReturnValueOnce({
          select: () => ({
            eq: () => ({
              neq: () => ({
                maybeSingle: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({ select: () => ({ contains }) });

      const result = await findActiveSaleByEmail("perso@gmail.com");

      expect(result.data).toEqual(salesRecord);
      expect(contains).toHaveBeenCalledWith(
        "secondary_emails",
        '["perso@gmail.com"]',
      );
    });

    it("attributes to nobody when two sales share the same secondary email", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      mockFrom.mockReturnValueOnce(primaryLookupMiss).mockReturnValueOnce({
        select: () => ({
          contains: () =>
            secondaryLookupResult([
              { id: 3, email: "a@company.com" },
              { id: 9, email: "b@company.com" },
            ]),
        }),
      });

      const result = await findActiveSaleByEmail("shared@x.com");

      expect(result.data).toBe(null);
      expect(result.error).toBe(null);

      consoleSpy.mockRestore();
    });

    it("names both sales in the logs when it refuses an ambiguous sender", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      mockFrom.mockReturnValueOnce(primaryLookupMiss).mockReturnValueOnce({
        select: () => ({
          contains: () =>
            secondaryLookupResult([
              { id: 3, email: "a@company.com" },
              { id: 9, email: "b@company.com" },
            ]),
        }),
      });

      await findActiveSaleByEmail("shared@x.com");

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("shared@x.com"),
      );
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("3, 9"));

      consoleSpy.mockRestore();
    });

    it("surfaces a failure of the secondary lookup instead of reporting no sale", async () => {
      mockFrom.mockReturnValueOnce(primaryLookupMiss).mockReturnValueOnce({
        select: () => ({
          contains: () => secondaryLookupResult([], { message: "DB error" }),
        }),
      });

      const result = await findActiveSaleByEmail("perso@gmail.com");

      expect(result.data).toBe(null);
      expect(result.error).toEqual({ message: "DB error" });
    });

    it("returns no sale rather than an error when nothing matches", async () => {
      mockFrom
        .mockReturnValueOnce({
          select: () => ({
            eq: () => ({
              neq: () => ({
                maybeSingle: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: () => ({ contains: () => secondaryLookupResult([]) }),
        });

      const result = await findActiveSaleByEmail("nobody@x.com");

      expect(result.data).toBe(null);
      expect(result.error).toBe(null);
    });

    it("lowercases the sender, since the jsonb lookup is case sensitive unlike the citext column", async () => {
      const salesRecord = {
        id: 1,
        email: "sales@company.com",
        secondary_emails: ["perso@gmail.com"],
      };
      const eq = vi.fn().mockReturnValue({
        neq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      });
      const contains = vi
        .fn()
        .mockReturnValue(secondaryLookupResult([salesRecord]));

      mockFrom
        .mockReturnValueOnce({ select: () => ({ eq }) })
        .mockReturnValueOnce({ select: () => ({ contains }) });

      const result = await findActiveSaleByEmail("  Perso@Gmail.COM  ");

      expect(eq).toHaveBeenCalledWith("email", "perso@gmail.com");
      expect(contains).toHaveBeenCalledWith(
        "secondary_emails",
        '["perso@gmail.com"]',
      );
      expect(result.data).toEqual(salesRecord);
    });

    it("does not look up the secondary emails when the first query fails", async () => {
      mockFrom.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            neq: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: null, error: { message: "DB error" } }),
            }),
          }),
        }),
      });

      const result = await findActiveSaleByEmail("sales@company.com");

      expect(result.error).toEqual({ message: "DB error" });
      expect(mockFrom).toHaveBeenCalledTimes(1);
    });
  });

  describe("addNoteToContact", () => {
    const sales = { id: 1 };
    const baseParams = {
      sales,
      salesEmail: "sales@company.com",
      email: "alice@acme.com",
      domain: "acme.com",
      firstName: "Alice",
      lastName: "Smith",
      noteContent: "A note",
      attachments: [],
      companyName: "Acme",
      website: "https://acme.com",
    };

    const contactFound = (contact: unknown) => ({
      select: () => ({
        contains: () => ({
          maybeSingle: () => Promise.resolve({ data: contact, error: null }),
        }),
      }),
    });

    it("creates a note and returns undefined on success", async () => {
      const existingContact = {
        id: 10,
        first_name: "Alice",
        last_name: "Smith",
      };

      mockFrom
        .mockReturnValueOnce(contactFound(existingContact))
        .mockReturnValueOnce({
          insert: () => Promise.resolve({ error: null }),
        })
        .mockReturnValueOnce({
          update: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        });

      const result = await addNoteToContact(baseParams);

      expect(result).toBeUndefined();
      expect(mockFrom).toHaveBeenCalledTimes(3);
      expect(mockFrom).toHaveBeenNthCalledWith(2, "contact_notes");
      expect(mockFrom).toHaveBeenNthCalledWith(3, "contacts");
    });

    it("files the note under the sale it was given, without looking one up", async () => {
      const insertNote = vi.fn().mockResolvedValue({ error: null });

      mockFrom
        .mockReturnValueOnce(contactFound({ id: 10 }))
        .mockReturnValueOnce({ insert: insertNote })
        .mockReturnValueOnce({
          update: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        });

      const result = await addNoteToContact({
        ...baseParams,
        sales: { id: 7 },
      });

      expect(result).toBeUndefined();
      expect(insertNote).toHaveBeenCalledWith(
        expect.objectContaining({ sales_id: 7, contact_id: 10 }),
      );
      expect(mockFrom).not.toHaveBeenCalledWith("sales");
    });

    it("returns 500 when inserting the note into contact_notes fails", async () => {
      mockFrom
        .mockReturnValueOnce(contactFound({ id: 10 }))
        .mockReturnValueOnce({
          insert: () =>
            Promise.resolve({ error: { message: "Insert failed" } }),
        });

      const response = await addNoteToContact(baseParams);

      expect(response).toBeInstanceOf(Response);
      expect(response!.status).toBe(500);
      expect(await response!.text()).toBe(
        "Could not add note to contact alice@acme.com, sales sales@company.com",
      );
      expect(mockFrom).toHaveBeenCalledTimes(2);
    });

    it("returns 500 when getOrCreateContactFromEmailInfo throws", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      mockFrom.mockReturnValueOnce({
        select: () => ({
          contains: () => ({
            maybeSingle: () =>
              Promise.resolve({ data: null, error: { message: "DB error" } }),
          }),
        }),
      });

      const response = await addNoteToContact(baseParams);

      expect(response).toBeInstanceOf(Response);
      expect(response!.status).toBe(500);
      expect(await response!.text()).toBe(
        "Could not get or create contact from database, email: alice@acme.com, sales: sales@company.com",
      );
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
