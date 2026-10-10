// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { getAcceptedIssuers } from "./jwtIssuer";

const discoveryResponse = (body: unknown, ok = true) =>
  vi.fn().mockResolvedValue({ ok, json: async () => body });

describe("getAcceptedIssuers", () => {
  it("accepts the configured issuer and the one advertised by the auth server", async () => {
    const fetchFn = discoveryResponse({
      issuer: "https://crm.example.com/auth/v1",
    });
    const result = await getAcceptedIssuers(
      "http://kong:8000",
      "http://127.0.0.1:54321/auth/v1",
      fetchFn,
    );
    expect(fetchFn).toHaveBeenCalledWith(
      "http://kong:8000/auth/v1/.well-known/openid-configuration",
    );
    expect(result).toEqual({
      issuers: [
        "http://127.0.0.1:54321/auth/v1",
        "https://crm.example.com/auth/v1",
      ],
      discovered: true,
    });
  });

  it("defaults the configured issuer to SUPABASE_URL/auth/v1", async () => {
    const result = await getAcceptedIssuers(
      "https://project.supabase.co",
      undefined,
      discoveryResponse({ issuer: "https://project.supabase.co/auth/v1" }),
    );
    expect(result).toEqual({
      issuers: ["https://project.supabase.co/auth/v1"],
      discovered: true,
    });
  });

  it("falls back to the configured issuer when discovery fails", async () => {
    const result = await getAcceptedIssuers(
      "http://kong:8000",
      "http://127.0.0.1:54321/auth/v1",
      vi.fn().mockRejectedValue(new Error("network down")),
    );
    expect(result).toEqual({
      issuers: ["http://127.0.0.1:54321/auth/v1"],
      discovered: false,
    });
  });

  it("falls back to the configured issuer on an error response", async () => {
    const result = await getAcceptedIssuers(
      "http://kong:8000",
      "http://127.0.0.1:54321/auth/v1",
      discoveryResponse({}, false),
    );
    expect(result).toEqual({
      issuers: ["http://127.0.0.1:54321/auth/v1"],
      discovered: false,
    });
  });

  it("ignores a missing or empty issuer in the discovery document", async () => {
    const result = await getAcceptedIssuers(
      "http://kong:8000",
      "http://127.0.0.1:54321/auth/v1",
      discoveryResponse({ issuer: "" }),
    );
    expect(result.issuers).toEqual(["http://127.0.0.1:54321/auth/v1"]);
  });
});
