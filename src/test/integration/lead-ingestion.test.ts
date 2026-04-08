import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { supabase, cleanupTestData } from "./supabase-client";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? "http://127.0.0.1:54341";
const INGEST_API_KEY =
  process.env.INGEST_API_KEY ?? process.env.SERVICE_ROLE_KEY!;

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
      lead_source: "Google",
      idempotency_key: `test-${Date.now()}`,
    };

    const response = await fetch(`${SUPABASE_URL}/functions/v1/ingest-lead`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": INGEST_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    expect(response.status).toBeLessThan(300);

    const result = await response.json();
    expect(result.company_id).toBeDefined();
    expect(result.contact_id).toBeDefined();
    expect(result.deal_id).toBeDefined();

    const { data: company } = await supabase
      .from("companies")
      .select("name")
      .eq("id", result.company_id)
      .single();

    expect(company?.name).toBe("Sunrise Roofing");

    const { data: contact } = await supabase
      .from("contacts")
      .select("first_name, last_name")
      .eq("id", result.contact_id)
      .single();

    expect(contact?.first_name).toBe("Mike");
    expect(contact?.last_name).toBe("Rivera");

    const { data: deal } = await supabase
      .from("deals")
      .select("name, stage")
      .eq("id", result.deal_id)
      .single();

    expect(deal?.stage).toBe("lead");
    expect(deal?.name).toBe("Sunrise Roofing - Inbound Lead");
  });

  it("is idempotent - same key returns cached result", async () => {
    const idempotencyKey = `idem-test-${Date.now()}`;

    const payload = {
      company_name: "Duplicate Test Corp",
      contact_first_name: "Jane",
      contact_last_name: "Dup",
      contact_email: "jane@dup.com",
      lead_source: "Manual",
      idempotency_key: idempotencyKey,
    };

    const res1 = await fetch(`${SUPABASE_URL}/functions/v1/ingest-lead`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": INGEST_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    expect(res1.status).toBeLessThan(300);
    const result1 = await res1.json();

    const res2 = await fetch(`${SUPABASE_URL}/functions/v1/ingest-lead`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": INGEST_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    expect(res2.status).toBeLessThan(300);
    const result2 = await res2.json();

    expect(result2.company_id).toBe(result1.company_id);
    expect(result2.contact_id).toBe(result1.contact_id);
    expect(result2.deal_id).toBe(result1.deal_id);

    const { data: companies } = await supabase
      .from("companies")
      .select("id")
      .ilike("name", "Duplicate Test Corp");

    expect(companies).toHaveLength(1);
  });

  it("rejects requests without API key", async () => {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/ingest-lead`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company_name: "Unauthorized",
        contact_first_name: "No",
        contact_last_name: "Auth",
      }),
    });

    expect(response.status).toBe(401);
  });
});
