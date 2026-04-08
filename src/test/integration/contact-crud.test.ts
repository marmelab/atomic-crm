import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  supabase,
  cleanupTestData,
  createTestUser,
  deleteTestUser,
} from "./supabase-client";

describe("Contact CRUD with tags", () => {
  let userId: string;
  let salesId: number;

  beforeAll(async () => {
    await cleanupTestData();
    const user = await createTestUser();
    userId = user.userId;
    salesId = user.salesId;
  });

  afterAll(async () => {
    await cleanupTestData();
    await deleteTestUser(userId);
  });

  it("creates a contact and assigns tags via join table", async () => {
    // Create tags
    const { data: tag1 } = await supabase
      .from("tags")
      .insert({ name: "VIP", color: "#ff0000" })
      .select("id")
      .single();

    const { data: tag2 } = await supabase
      .from("tags")
      .insert({ name: "Prospect", color: "#00ff00" })
      .select("id")
      .single();

    // Create company
    const { data: company } = await supabase
      .from("companies")
      .insert({ name: "Test Plumbing Co", sales_id: salesId })
      .select("id")
      .single();

    // Create contact
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .insert({
        first_name: "John",
        last_name: "Doe",
        company_id: company!.id,
        sales_id: salesId,
        first_seen: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        has_newsletter: false,
        tags: [],
        gender: "male",
        status: "cold",
        email_jsonb: [{ email: "john@test.com", type: "Work" }],
        phone_jsonb: [{ number: "555-0100", type: "Work" }],
      })
      .select("id")
      .single();

    expect(contactError).toBeNull();
    expect(contact).toBeDefined();

    // Assign tags via contact_tags join table
    const { error: tagError } = await supabase.from("contact_tags").insert([
      { contact_id: contact!.id, tag_id: tag1!.id },
      { contact_id: contact!.id, tag_id: tag2!.id },
    ]);

    expect(tagError).toBeNull();

    // Verify tags are linked
    const { data: linkedTags } = await supabase
      .from("contact_tags")
      .select("tag_id, tags(name)")
      .eq("contact_id", contact!.id);

    expect(linkedTags).toHaveLength(2);
    const tagNames = linkedTags!.map((t: any) => t.tags.name).sort();
    expect(tagNames).toEqual(["Prospect", "VIP"]);
  });

  it("reads contact via contacts_summary view", async () => {
    const { data: contacts, error } = await supabase
      .from("contacts_summary")
      .select("*")
      .eq("first_name", "John")
      .eq("last_name", "Doe");

    expect(error).toBeNull();
    expect(contacts).toHaveLength(1);
    expect(contacts![0].company_name).toBe("Test Plumbing Co");
  });

  it("updates contact tags — remove one, keep one", async () => {
    const { data: contact } = await supabase
      .from("contacts")
      .select("id")
      .eq("first_name", "John")
      .single();

    const { data: vipTag } = await supabase
      .from("tags")
      .select("id")
      .eq("name", "VIP")
      .single();

    // Remove VIP tag
    const { error: deleteError } = await supabase
      .from("contact_tags")
      .delete()
      .eq("contact_id", contact!.id)
      .eq("tag_id", vipTag!.id);

    expect(deleteError).toBeNull();

    // Verify only Prospect remains
    const { data: remaining } = await supabase
      .from("contact_tags")
      .select("tags(name)")
      .eq("contact_id", contact!.id);

    expect(remaining).toHaveLength(1);
    expect((remaining![0] as any).tags.name).toBe("Prospect");
  });

  it("deletes contact and cascades to contact_tags", async () => {
    const { data: contact } = await supabase
      .from("contacts")
      .select("id")
      .eq("first_name", "John")
      .single();

    const contactId = contact!.id;

    const { error: deleteError } = await supabase
      .from("contacts")
      .delete()
      .eq("id", contactId);

    expect(deleteError).toBeNull();

    // Verify cascade deleted contact_tags
    const { data: orphanTags } = await supabase
      .from("contact_tags")
      .select("*")
      .eq("contact_id", contactId);

    expect(orphanTags).toHaveLength(0);
  });
});
