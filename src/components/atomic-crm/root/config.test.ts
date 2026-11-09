import { describe, expect, it, vi } from "vitest";

import { config } from "./config";

// Hoisted: config is read once, when the import above loads. The
// fallback to the VITE_* variables is covered by the data provider tests.
vi.hoisted(() => {
  vi.stubEnv("VITE_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("VITE_INBOUND_EMAIL", "dev@inbound.example.com");
  window._atomicCrmConfig = { supabaseUrl: "https://acme.supabase.co" };
});

describe("config", () => {
  it("uses the deployment's config.js over the build variables", () => {
    expect(config).toEqual({ supabaseUrl: "https://acme.supabase.co" });
  });
});
