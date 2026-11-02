// @vitest-environment node
import { describe, expect, it } from "vitest";
import { resolveRoleUpdate } from "./roles";

describe("resolveRoleUpdate", () => {
  it("derives the administrator flag from the role", () => {
    expect(resolveRoleUpdate("admin", false)).toEqual({
      role: "admin",
      administrator: true,
    });
    expect(resolveRoleUpdate("bde", true)).toEqual({
      role: "bde",
      administrator: false,
    });
  });

  it("keeps legacy clients that only send the administrator flag working", () => {
    expect(resolveRoleUpdate(undefined, true)).toEqual({ administrator: true });
    expect(resolveRoleUpdate(null, false)).toEqual({ administrator: false });
  });

  it("rejects an unknown role with a 400", () => {
    expect(() => resolveRoleUpdate("owner", false)).toThrow(
      expect.objectContaining({ status: 400 }),
    );
  });
});
