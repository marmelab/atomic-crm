import { describe, it, expect } from "vitest";
import { extractMailContactData } from "./extractMailContactData";

describe("extractMailContactData", () => {
  it("extracts first name, last name, email, and domain when Name is provided", () => {
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
    });
    expect(result[1]).toMatchObject({
      firstName: "Bob",
      lastName: "Builder",
      domain: "bar.com",
    });
  });

  it("returns an empty array for empty input", () => {
    expect(extractMailContactData([])).toEqual([]);
  });
});
