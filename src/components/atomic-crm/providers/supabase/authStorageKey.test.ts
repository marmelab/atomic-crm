import { describe, expect, it } from "vitest";

import { buildSupabaseAuthStorageKey } from "./authStorageKey";

describe("buildSupabaseAuthStorageKey", () => {
  it("keeps remote project refs stable without adding an empty port", () => {
    expect(
      buildSupabaseAuthStorageKey("https://qvdmzhyzpyaveniirsmo.supabase.co"),
    ).toBe("sb-qvdmzhyzpyaveniirsmo-auth-token");
  });

  it("isolates local stacks running on the same host with different ports", () => {
    expect(buildSupabaseAuthStorageKey("http://127.0.0.1:55321")).toBe(
      "sb-127-55321-auth-token",
    );
    expect(buildSupabaseAuthStorageKey("http://127.0.0.1:54321")).toBe(
      "sb-127-54321-auth-token",
    );
  });

  it("sanitizes localhost-like hostnames", () => {
    expect(buildSupabaseAuthStorageKey("http://localhost:55321")).toBe(
      "sb-localhost-55321-auth-token",
    );
  });
});
