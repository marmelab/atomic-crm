import { describe, expect, it } from "vitest";
import type { CustomerProfileData } from "./buildCustomerProfile";
import { buildCustomerProfile } from "./buildCustomerProfile";
import type { Company, Contact } from "../types";

const company = {
  id: 1,
  name: "Testbolaget AB",
  org_number: "556677-8899",
  industry: "Bygg",
  address: "Storgatan 1",
  zipcode: "831 30",
  city: "Östersund",
  phone_number: "063-123456",
  website: "https://testbolaget.se",
  lead_status: "meeting_booked",
  description: "Familjeägt byggföretag.",
} as unknown as Company;

const contact = {
  id: 10,
  first_name: "Anna",
  last_name: "Svensson",
  title: "VD",
  email_jsonb: [{ email: "anna@testbolaget.se", type: "Work" }],
  phone_jsonb: [{ number: "070-1112233", type: "Work" }],
} as unknown as Contact;

const baseData: CustomerProfileData = {
  company,
  contacts: [contact],
  callLogs: [
    {
      id: 100,
      company_id: 1,
      call_outcome: "meeting_booked",
      notes: "Bokade möte om ny hemsida.",
      created_at: "2026-06-09T15:14:59Z",
    },
  ],
  deals: [
    {
      id: 200,
      name: "Ny hemsida",
      company_id: 1,
      contact_ids: [10],
      category: "Webb",
      stage: "opportunity",
      description: "",
      amount: 45000,
      created_at: "2026-06-01T00:00:00Z",
      updated_at: "2026-06-09T00:00:00Z",
      expected_closing_date: "",
      sales_id: 1,
      index: 0,
    },
  ],
  quotes: [
    {
      id: 300,
      title: "Hemsida bas",
      quote_number: "Q-2026-014",
      company_id: 1,
      status: "sent",
      subtotal: 36000,
      vat_rate: 25,
      vat_amount: 9000,
      discount_percent: 0,
      total_amount: 45000,
      currency: "SEK",
      created_at: "2026-06-05T00:00:00Z",
      updated_at: "2026-06-05T00:00:00Z",
    },
  ],
  contactNotes: [
    {
      id: 400,
      contact_id: 10,
      text: "Vill se exempel på tidigare byggsajter.",
      date: "2026-06-08T00:00:00Z",
      sales_id: 1,
      status: "cold",
    },
  ],
  dealNotes: [
    {
      id: 500,
      deal_id: 200,
      text: "Budget bekräftad.",
      date: "2026-06-09T00:00:00Z",
      sales_id: 1,
    },
  ],
  tasks: [
    {
      id: 600,
      contact_id: 10,
      type: "Call",
      text: "Skicka referenser",
      due_date: "2026-06-12T00:00:00Z",
      done_date: null,
    },
  ],
  dealStages: [
    { value: "opportunity", label: "Möjlighet" },
    { value: "won", label: "Vunnen" },
  ],
};

describe("buildCustomerProfile", () => {
  it("renders all sections with Swedish headings", () => {
    const md = buildCustomerProfile(baseData);

    expect(md).toContain("# Kundbild: Testbolaget AB");
    expect(md).toContain("## Företag");
    expect(md).toContain("## Kontakter");
    expect(md).toContain("## Samtalslogg (nyast först)");
    expect(md).toContain("## Affärer");
    expect(md).toContain("## Offerter");
    expect(md).toContain("## Anteckningar (nyast först)");
    expect(md).toContain("## Uppgifter");
  });

  it("includes company, contact, and call log details", () => {
    const md = buildCustomerProfile(baseData);

    expect(md).toContain("Org.nr: 556677-8899");
    expect(md).toContain("Lead-status: Möte bokat");
    expect(md).toContain("**Anna Svensson** — VD, anna@testbolaget.se");
    expect(md).toContain("Möte bokat — Bokade möte om ny hemsida.");
  });

  it("maps deal stage via dealStages and formats amounts in sv-SE", () => {
    const md = buildCustomerProfile(baseData);

    expect(md).toContain("**Ny hemsida** — fas: Möjlighet");
    // sv-SE uses non-breaking space as thousands separator
    expect(md.replace(/[  ]/g, " ")).toContain("45 000 SEK");
  });

  it("sorts notes newest first and labels their origin", () => {
    const md = buildCustomerProfile(baseData);

    const dealNoteIndex = md.indexOf("Affär Ny hemsida: Budget bekräftad.");
    const contactNoteIndex = md.indexOf(
      "Kontakt Anna Svensson: Vill se exempel",
    );
    expect(dealNoteIndex).toBeGreaterThan(-1);
    expect(contactNoteIndex).toBeGreaterThan(-1);
    expect(dealNoteIndex).toBeLessThan(contactNoteIndex);
  });

  it("renders placeholder text for empty sections", () => {
    const md = buildCustomerProfile({
      ...baseData,
      callLogs: [],
      deals: [],
      quotes: [],
      contactNotes: [],
      dealNotes: [],
      tasks: [],
    });

    expect(md).toContain("_Inget registrerat._");
  });

  it("marks open and done tasks", () => {
    const md = buildCustomerProfile(baseData);
    expect(md).toContain("⬜ öppen · Skicka referenser (Anna Svensson)");
  });
});
