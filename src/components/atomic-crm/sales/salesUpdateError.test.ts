import { describe, it, expect } from "vitest";
import { getSalesUpdateNotification } from "./salesUpdateError";

describe("getSalesUpdateNotification", () => {
  it("names the address rejected as already taken", () => {
    expect(
      getSalesUpdateNotification(
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
      getSalesUpdateNotification(
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
      getSalesUpdateNotification(
        Object.assign(new Error("boom"), { code: "something_else" }),
      ).message,
    ).toBe("crm.profile.update_error");
  });

  it("falls back to the generic message for an error carrying no code", () => {
    expect(getSalesUpdateNotification(new Error("boom")).message).toBe(
      "crm.profile.update_error",
    );
  });

  it("does not throw when there is no error object at all", () => {
    expect(getSalesUpdateNotification(undefined)).toEqual({
      message: "crm.profile.update_error",
      args: { email: "" },
    });
  });
});
