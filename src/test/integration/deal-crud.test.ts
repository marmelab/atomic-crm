import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  supabase,
  cleanupTestData,
  createTestUser,
  deleteTestUser,
} from "./supabase-client";

describe("Deal CRUD with contacts", () => {
  let userId: string;
  let salesId: number;
  let companyId: number;
  let contact1Id: number;
  let contact2Id: number;

  beforeAll(async () => {
    await cleanupTestData();
    const user = await createTestUser();
    userId = user.userId;
    salesId = user.salesId;

    // Create company
    const { data: company } = await supabase
      .from("companies")
      .insert({ name: "HVAC Masters Inc", sales_id: salesId })
      .select("id")
      .single();
    companyId = company!.id;

    // Create contacts
    const contactBase = {
      sales_id: salesId,
      company_id: companyId,
      first_seen: new Date().toISOString(),
      last_seen: new Date().toISOString(),
      has_newsletter: false,
      tags: [],
      gender: "unknown" as const,
      status: "cold",
      email_jsonb: [],
      phone_jsonb: [],
    };

    const { data: c1 } = await supabase
      .from("contacts")
      .insert({ ...contactBase, first_name: "Alice", last_name: "Smith" })
      .select("id")
      .single();
    contact1Id = c1!.id;

    const { data: c2 } = await supabase
      .from("contacts")
      .insert({ ...contactBase, first_name: "Bob", last_name: "Jones" })
      .select("id")
      .single();
    contact2Id = c2!.id;
  });

  afterAll(async () => {
    await cleanupTestData();
    await deleteTestUser(userId);
  });

  it("creates a deal and links contacts via join table", async () => {
    const { data: deal, error: dealError } = await supabase
      .from("deals")
      .insert({
        name: "HVAC Retrofit Project",
        company_id: companyId,
        stage: "discovery",
        amount: 25000,
        sales_id: salesId,
        contact_ids: [],
      })
      .select("id")
      .single();

    expect(dealError).toBeNull();
    expect(deal).toBeDefined();

    // Link contacts via deal_contacts join table
    const { error: linkError } = await supabase
      .from("deal_contacts")
      .insert([
        { deal_id: deal!.id, contact_id: contact1Id },
        { deal_id: deal!.id, contact_id: contact2Id },
      ]);

    expect(linkError).toBeNull();

    // Verify contacts linked
    const { data: linked } = await supabase
      .from("deal_contacts")
      .select("contact_id, contacts(first_name)")
      .eq("deal_id", deal!.id);

    expect(linked).toHaveLength(2);
    const names = linked!.map((l: any) => l.contacts.first_name).sort();
    expect(names).toEqual(["Alice", "Bob"]);
  });

  it("removes a contact from a deal", async () => {
    const { data: deal } = await supabase
      .from("deals")
      .select("id")
      .eq("name", "HVAC Retrofit Project")
      .single();

    // Remove Bob
    const { error } = await supabase
      .from("deal_contacts")
      .delete()
      .eq("deal_id", deal!.id)
      .eq("contact_id", contact2Id);

    expect(error).toBeNull();

    // Verify only Alice remains
    const { data: remaining } = await supabase
      .from("deal_contacts")
      .select("contacts(first_name)")
      .eq("deal_id", deal!.id);

    expect(remaining).toHaveLength(1);
    expect((remaining![0] as any).contacts.first_name).toBe("Alice");
  });

  it("deletes a deal and cascades to deal_contacts", async () => {
    const { data: deal } = await supabase
      .from("deals")
      .select("id")
      .eq("name", "HVAC Retrofit Project")
      .single();

    const dealId = deal!.id;

    const { error } = await supabase
      .from("deals")
      .delete()
      .eq("id", dealId);

    expect(error).toBeNull();

    // Verify cascade
    const { data: orphaned } = await supabase
      .from("deal_contacts")
      .select("*")
      .eq("deal_id", dealId);

    expect(orphaned).toHaveLength(0);

    // Contacts should still exist
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id")
      .in("id", [contact1Id, contact2Id]);

    expect(contacts).toHaveLength(2);
  });
});
