import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { supabase, cleanupTestData } from "./supabase-client";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? "http://127.0.0.1:54341";
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY!;

describe("Lead ingestion edge function", () => {
  beforeAll(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it("creates company + contact + deal from a lead ingestion POST", async () => {
    const payload = {
      company_name: "Sunrise Roofing",
      contact_first_name: "Mike",
      contact_last_name: "Rivera",
      contact_email: "mike@sunriseroofing.com",
      contact_phone: "555-0200",
      deal_name: "Sunrise Roofing — Inbound Lead",
      deal_amount: 15000,
      source: "google_places",
      idempotency_key: `test-${Date.now()}`,
    };

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/ingest-lead`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": SERVICE_ROLE_KEY,
        },
        body: JSON.stringify(payload),
      },
    );

    // Edge function should return 200 or 201
    expect(response.status).toBeLessThan(300);

    const result = await response.json();
    expect(result.company_id).toBeDefined();
    expect(result.contact_id).toBeDefined();
    expect(result.deal_id).toBeDefined();

    // Verify company was created
    const { data: company } = await supabase
      .from("companies")
      .select("name")
      .eq("id", result.company_id)
      .single();

    expect(company?.name).toBe("Sunrise Roofing");

    // Verify contact was created
    const { data: contact } = await supabase
      .from("contacts")
      .select("first_name, last_name")
      .eq("id", result.contact_id)
      .single();

    expect(contact?.first_name).toBe("Mike");
    expect(contact?.last_name).toBe("Rivera");

    // Verify deal was created in "lead" stage
    const { data: deal } = await supabase
      .from("deals")
      .select("name, stage, amount")
      .eq("id", result.deal_id)
      .single();

    expect(deal?.stage).toBe("lead");
    expect(deal?.amount).toBe(15000);
  });

  it("is idempotent — same key returns cached result", async () => {
    const idempotencyKey = `idem-test-${Date.now()}`;

    const payload = {
      company_name: "Duplicate Test Corp",
      contact_first_name: "Jane",
      contact_last_name: "Dup",
      contact_email: "jane@dup.com",
      deal_name: "Dup Test Lead",
      deal_amount: 5000,
      source: "manual",
      idempotency_key: idempotencyKey,
    };

    // First call
    const res1 = await fetch(
      `${SUPABASE_URL}/functions/v1/ingest-lead`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": SERVICE_ROLE_KEY,
        },
        body: JSON.stringify(payload),
      },
    );

    expect(res1.status).toBeLessThan(300);
    const result1 = await res1.json();

    // Second call with same key
    const res2 = await fetch(
      `${SUPABASE_URL}/functions/v1/ingest-lead`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": SERVICE_ROLE_KEY,
        },
        body: JSON.stringify(payload),
      },
    );

    expect(res2.status).toBeLessThan(300);
    const result2 = await res2.json();

    // Should return same IDs — no duplicate records
    expect(result2.company_id).toBe(result1.company_id);
    expect(result2.contact_id).toBe(result1.contact_id);
    expect(result2.deal_id).toBe(result1.deal_id);

    // Verify only one company with this name
    const { data: companies } = await supabase
      .from("companies")
      .select("id")
      .ilike("name", "Duplicate Test Corp");

    expect(companies).toHaveLength(1);
  });

  it("rejects requests without API key", async () => {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/ingest-lead`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: "Unauthorized",
          contact_first_name: "No",
          contact_last_name: "Auth",
        }),
      },
    );

    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});
