import { describe, expect, it, vi } from "vitest";

import { getDataProvider } from "./dataProvider";

const rpc = vi.fn();

vi.mock("./supabase", () => ({
  getSupabaseClient: () => ({ rpc }),
}));

// Hoisted: config reads the env once, when the imports above load.
vi.hoisted(() => {
  vi.stubEnv("VITE_SUPABASE_URL", "http://localhost:54321");
  vi.stubEnv("VITE_SB_PUBLISHABLE_KEY", "test-key");
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
