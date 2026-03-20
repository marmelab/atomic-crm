import { describe, it, expect } from "vitest";
import {
  extractMailContactData,
  extractCompanyName,
} from "./extractMailContactData";

describe("extractMailContactData", () => {
  it("extracts first name, last name, email, domain, company name, and website when Name is provided", () => {
    expect(
      extractMailContactData([
        {
          Email: "firstname.lastname@marmelab.com",
          Name: "Firstname Lastname",
        },
      ]),
    ).toEqual([
      {
        firstName: "Firstname",
        lastName: "Lastname",
        email: "firstname.lastname@marmelab.com",
        domain: "marmelab.com",
        companyName: "Marmelab",
        website: "https://marmelab.com",
      },
    ]);
  });

  it("derives name from email address when Name is empty", () => {
    expect(
      extractMailContactData([{ Email: "john.doe@example.com", Name: "" }]),
    ).toEqual([
      {
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        domain: "example.com",
        companyName: "Example",
        website: "https://example.com",
      },
    ]);
  });

  it("sets empty firstName and capitalizes lastName when name has no space", () => {
    expect(
      extractMailContactData([{ Email: "alice@example.com", Name: "Alice" }]),
    ).toEqual([
      {
        firstName: "",
        lastName: "Alice",
        companyName: "Example",
        website: "https://example.com",
        email: "alice@example.com",
        domain: "example.com",
      },
    ]);
  });

  it("handles multi-part last name", () => {
    expect(
      extractMailContactData([
        {
          Email: "jean.de.la.fontaine@example.com",
          Name: "Jean De La Fontaine",
        },
      ]),
    ).toEqual([
      {
        firstName: "Jean",
        lastName: "De La Fontaine",
        companyName: "Example",
        website: "https://example.com",
        email: "jean.de.la.fontaine@example.com",
        domain: "example.com",
      },
    ]);
  });

  it("capitalizes names derived from email address", () => {
    expect(
      extractMailContactData([{ Email: "jane.smith@company.org", Name: "" }]),
    ).toEqual([
      {
        companyName: "Company",
        website: "https://company.org",
        firstName: "Jane",
        lastName: "Smith",
        email: "jane.smith@company.org",
        domain: "company.org",
      },
    ]);
  });

  it("capitalizes names derived from Name field", () => {
    expect(
      extractMailContactData([
        {
          Email: "jane.smith@company.org",
          Name: "jane smith",
        },
      ]),
    ).toEqual([
      {
        companyName: "Company",
        website: "https://company.org",
        firstName: "Jane",
        lastName: "Smith",
        email: "jane.smith@company.org",
        domain: "company.org",
      },
    ]);
  });

  it("processes multiple contacts", () => {
    const result = extractMailContactData([
      { Email: "alice@foo.com", Name: "Alice Wonder" },
      { Email: "bob@bar.com", Name: "Bob Builder" },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      firstName: "Alice",
      lastName: "Wonder",
      domain: "foo.com",
      companyName: "Foo",
      website: "https://foo.com",
    });
    expect(result[1]).toMatchObject({
      firstName: "Bob",
      lastName: "Builder",
      domain: "bar.com",
      companyName: "Bar",
      website: "https://bar.com",
    });
  });

  it("returns an empty array for empty input", () => {
    expect(extractMailContactData([])).toEqual([]);
  });

  it("should lowercase email addresses", () => {
    expect(
      extractMailContactData([
        {
          Email: "Firstname.Lastname@marmelab.com",
          Name: "Firstname Lastname",
        },
      ]),
    ).toEqual([
      {
        firstName: "Firstname",
        lastName: "Lastname",
        email: "firstname.lastname@marmelab.com",
        domain: "marmelab.com",
        companyName: "Marmelab",
        website: "https://marmelab.com",
      },
    ]);
  });

  describe("extractCompanyName", () => {
    it("extracts company name from lowercase domain", () => {
      expect(extractCompanyName("marmelab.com")).toBe("Marmelab");
    });

    it("extracts company name from uppercase domain", () => {
      expect(extractCompanyName("Marmelab.com")).toBe("Marmelab");
    });

    it("extracts company name from common free email provider", () => {
      expect(extractCompanyName("gmail.com")).toBe("Gmail");
    });

    it("extracts company name from multi-part TLD (.co.uk)", () => {
      expect(extractCompanyName("example.co.uk")).toBe("Example");
    });

    it("extracts company name with hyphen and converts to title case", () => {
      expect(extractCompanyName("example-company.co.uk")).toBe(
        "Example Company",
      );
    });

    it("extracts company name with underscore and converts to title case", () => {
      expect(extractCompanyName("Example_Company.com")).toBe("Example Company");
    });

    it("extracts company name with multiple hyphens", () => {
      expect(extractCompanyName("my-super-cool-company.com")).toBe(
        "My Super Cool Company",
      );
    });

    it("extracts company name with multiple underscores", () => {
      expect(extractCompanyName("my_super_cool_company.com")).toBe(
        "My Super Cool Company",
      );
    });

    it("extracts company name with mixed separators", () => {
      expect(extractCompanyName("my-super_cool-company.com")).toBe(
        "My Super Cool Company",
      );
    });

    it("handles invalid or unknown TLD domains gracefully", () => {
      expect(extractCompanyName("invalid.domain")).toBe("Invalid");
    });

    it("returns empty string for empty domain", () => {
      expect(extractCompanyName("")).toBe("");
    });

    it("handles domain with no TLD separator", () => {
      expect(extractCompanyName("nodots")).toBe("Nodots");
    });
  });
});
