import { describe, expect, it, vi } from "vitest";

import { getDataProvider } from "./dataProvider";

const rpc = vi.fn();

vi.mock("./supabase", () => ({
  getSupabaseClient: () => ({ rpc }),
}));

// Hoisted: config is read once, when the imports above load.
vi.hoisted(() => {
  window._atomicCrmConfig = {
    supabaseUrl: "http://localhost:54321",
    supabasePublishableKey: "test-key",
  };
});

describe("globalSearch", () => {
  it("rejects with the HTTP status so an expired session logs out", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "PGRST303", message: "JWT expired" },
      status: 401,
    });

    await expect(
      getDataProvider().globalSearch("acme", ["companies"], 10),
    ).rejects.toMatchObject({ status: 401 });
  });
});
