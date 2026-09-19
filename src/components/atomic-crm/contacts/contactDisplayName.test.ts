import { describe, expect, test } from "vitest";

import {
  contactDisplayName,
  contactDisplayNameOr,
  contactInitials,
} from "./contactDisplayName";

// What to call a person, in one place.
//
// This was written out by hand in 58 places, nearly always as
// `${first_name ?? ""} ${last_name ?? ""}`.trim(), which is right until
// somebody has only one name — 33 Contacts in production do.

describe("contactDisplayName", () => {
  test("joins both names", () => {
    expect(
      contactDisplayName({ first_name: "Ada", last_name: "Lovelace" }),
    ).toBe("Ada Lovelace");
  });

  test("a single name renders with no stray space", () => {
    // Arrange — the case the 58 copies got subtly wrong.
    expect(contactDisplayName({ first_name: "Prince", last_name: "" })).toBe(
      "Prince",
    );
    expect(contactDisplayName({ first_name: null, last_name: "Cher" })).toBe(
      "Cher",
    );
  });

  test("surrounding whitespace never reaches the screen", () => {
    expect(
      contactDisplayName({ first_name: "  Ada  ", last_name: " Lovelace " }),
    ).toBe("Ada Lovelace");
  });

  test("no name at all is null, never an empty-looking string", () => {
    // Assert — the caller decides what to show instead; this never
    // invents one and never falls back to an id.
    expect(contactDisplayName({ first_name: "", last_name: null })).toBeNull();
    expect(contactDisplayName(null)).toBeNull();
    expect(contactDisplayName(undefined)).toBeNull();
  });

  test("the fallback is the caller's, because there is no universal one", () => {
    expect(contactDisplayNameOr(null, "Unknown applicant")).toBe(
      "Unknown applicant",
    );
    expect(
      contactDisplayNameOr({ first_name: "Ada", last_name: null }, "fallback"),
    ).toBe("Ada");
  });
});

describe("contactInitials", () => {
  test("takes one letter from each name it has", () => {
    expect(contactInitials({ first_name: "Ada", last_name: "Lovelace" })).toBe(
      "AL",
    );
    expect(contactInitials({ first_name: "Prince", last_name: null })).toBe(
      "P",
    );
  });

  test("no name means no initials, not a stray letter", () => {
    expect(contactInitials({ first_name: "", last_name: "" })).toBe("");
    expect(contactInitials(null)).toBe("");
  });
});
