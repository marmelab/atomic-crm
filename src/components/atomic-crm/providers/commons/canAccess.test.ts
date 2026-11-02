import { describe, expect, it } from "vitest";

import { canAccess, resolveRole } from "./canAccess";

describe("canAccess", () => {
  it("lets an admin reach everything", () => {
    for (const resource of [
      "sales",
      "configuration",
      "recycle_pool",
      "contacts",
    ]) {
      expect(canAccess("admin", { action: "list", resource })).toBe(true);
    }
  });

  it("gives a manager the team tools but not users or configuration", () => {
    expect(
      canAccess("manager", { action: "list", resource: "recycle_pool" }),
    ).toBe(true);
    expect(
      canAccess("manager", { action: "list", resource: "whatsapp_approvals" }),
    ).toBe(true);
    expect(canAccess("manager", { action: "list", resource: "sales" })).toBe(
      false,
    );
    expect(
      canAccess("manager", { action: "edit", resource: "configuration" }),
    ).toBe(false);
  });

  it("keeps a bde away from team tools while leaving their own work open", () => {
    for (const resource of [
      "lead_import",
      "call_assignments",
      "recycle_pool",
      "whatsapp_approvals",
      "brochures",
      "reports",
      "sales",
    ]) {
      expect(canAccess("bde", { action: "list", resource })).toBe(false);
    }
    expect(canAccess("bde", { action: "list", resource: "contacts" })).toBe(
      true,
    );
    expect(canAccess("bde", { action: "list", resource: "my_calls" })).toBe(
      true,
    );
  });
});

describe("resolveRole", () => {
  it("uses the stored role when it is valid", () => {
    expect(resolveRole({ role: "bde", administrator: false })).toBe("bde");
  });

  it("maps legacy records from the administrator flag", () => {
    expect(resolveRole({ administrator: true })).toBe("admin");
    expect(resolveRole({ administrator: false })).toBe("manager");
    expect(resolveRole({ role: "owner", administrator: false })).toBe(
      "manager",
    );
  });
});
