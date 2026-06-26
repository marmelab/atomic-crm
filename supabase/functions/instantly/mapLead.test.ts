import { describe, it, expect } from "vitest";
import { mapLead, pickPrimaryEmail } from "./mapLead";

describe("pickPrimaryEmail", () => {
  it("prefers a Work address", () => {
    expect(
      pickPrimaryEmail([
        { email: "home@x.com", type: "Home" },
        { email: "work@x.com", type: "Work" },
      ]),
    ).toBe("work@x.com");
  });

  it("falls back to the first email when no Work address", () => {
    expect(pickPrimaryEmail([{ email: "a@x.com", type: "Other" }])).toBe(
      "a@x.com",
    );
  });

  it("returns null when there are no emails", () => {
    expect(pickPrimaryEmail([])).toBeNull();
    expect(pickPrimaryEmail(undefined)).toBeNull();
  });
});

describe("mapLead", () => {
  it("maps a contact to an Instantly lead", () => {
    expect(
      mapLead({
        first_name: "Ada",
        last_name: "Lovelace",
        company_name: "Analytical Engines",
        email_jsonb: [{ email: "ada@x.com", type: "Work" }],
      }),
    ).toEqual({
      email: "ada@x.com",
      first_name: "Ada",
      last_name: "Lovelace",
      company_name: "Analytical Engines",
    });
  });

  it("returns null when the contact has no email", () => {
    expect(mapLead({ first_name: "Ada", email_jsonb: [] })).toBeNull();
  });
});
