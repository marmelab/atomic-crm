import { describe, it, expect } from "vitest";
import { getSalesErrorNotification } from "./salesErrorNotification";

describe("getSalesErrorNotification", () => {
  it("names the address rejected as already taken", () => {
    expect(
      getSalesErrorNotification(
        Object.assign(new Error("Secondary email already used"), {
          code: "secondary_email_taken",
          email: "shared@x.com",
        }),
      ),
    ).toEqual({
      message: "crm.profile.secondary_email_taken",
      args: { email: "shared@x.com" },
    });
  });

  it("names the address rejected as malformed", () => {
    expect(
      getSalesErrorNotification(
        Object.assign(new Error("Invalid secondary email"), {
          code: "invalid_secondary_email",
          email: "not-an-email",
        }),
      ),
    ).toEqual({
      message: "crm.profile.secondary_email_invalid",
      args: { email: "not-an-email" },
    });
  });

  it("falls back to the generic message for an unknown code", () => {
    expect(
      getSalesErrorNotification(
        Object.assign(new Error("boom"), { code: "something_else" }),
      ).message,
    ).toBe("crm.profile.update_error");
  });

  it("falls back to the generic message for an error carrying no code", () => {
    expect(getSalesErrorNotification(new Error("boom")).message).toBe(
      "crm.profile.update_error",
    );
  });

  it("does not throw when there is no error object at all", () => {
    expect(getSalesErrorNotification(undefined)).toEqual({
      message: "crm.profile.update_error",
      args: { email: "" },
    });
  });

  it("names the address that is already the main one", () => {
    expect(
      getSalesErrorNotification(
        Object.assign(new Error("already primary"), {
          code: "secondary_email_is_primary",
          email: "me@corp.com",
        }),
      ),
    ).toEqual({
      message: "crm.profile.secondary_email_is_primary",
      args: { email: "me@corp.com" },
    });
  });

  it("reports the cap without needing an address", () => {
    expect(
      getSalesErrorNotification(
        Object.assign(new Error("too many"), {
          code: "too_many_secondary_emails",
        }),
      ).message,
    ).toBe("crm.profile.too_many_secondary_emails");
  });

  it("keeps the server reason when the caller passes it as fallback", () => {
    expect(
      getSalesErrorNotification(
        new Error("Password should be at least 6 characters"),
        "Password should be at least 6 characters",
      ).message,
    ).toBe("Password should be at least 6 characters");
  });

  it("uses the caller's fallback so admin pages keep their own wording", () => {
    expect(
      getSalesErrorNotification(
        new Error("boom"),
        "resources.sales.create.error",
      ).message,
    ).toBe("resources.sales.create.error");
  });

  it("keeps the specific message over the caller's fallback", () => {
    expect(
      getSalesErrorNotification(
        Object.assign(new Error("taken"), {
          code: "email_taken",
          email: "dup@x.com",
        }),
        "resources.sales.create.error",
      ),
    ).toEqual({
      message: "crm.profile.email_taken",
      args: { email: "dup@x.com" },
    });
  });
});
