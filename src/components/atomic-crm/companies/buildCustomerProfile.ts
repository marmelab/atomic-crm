import type { DealStage } from "../types";
import type {
  CallLog,
  Company,
  Contact,
  ContactNote,
  Deal,
  DealNote,
  Quote,
  Task,
} from "../types";
import { findDealLabel } from "../deals/dealUtils";

/**
 * Pure builder: turns fetched CRM data into a Swedish markdown "kundbild"
 * meant to be pasted into Claude Desktop for meeting preparation.
 * No data fetching here — CopyCustomerProfileButton gathers the data.
 */

export type CustomerProfileData = {
  company: Company;
  contacts: Contact[];
  callLogs: CallLog[];
  deals: Deal[];
  quotes: Quote[];
  contactNotes: ContactNote[];
  dealNotes: DealNote[];
  tasks: Task[];
  dealStages: DealStage[];
};

const OUTCOME_LABELS: Record<string, string> = {
  none: "Inget resultat",
  hot_lead: "Het lead",
  active_customer: "Aktiv kund",
  under_negotiation: "Under förhandling",
  follow_up: "Att följa upp",
  never_contacted: "Aldrig kontaktad",
  contacted_no_response: "Kontaktad, inget svar",
  not_interested: "Inte intresserad",
  // Legacy outcomes (historical data)
  no_answer: "Inget svar",
  busy: "Upptaget",
  wrong_number: "Fel nummer",
  spoke_gatekeeper: "Pratade med gatekeeper",
  spoke_decision_maker: "Pratade med beslutsfattare",
  interested: "Intresserad",
  meeting_booked: "Möte bokat",
  send_info: "Skicka info",
  callback_requested: "Ring upp igen",
};

const LEAD_STATUS_LABELS: Record<string, string> = {
  new: "Ny",
  contacted: "Kontaktad",
  no_response: "Inget svar",
  info_sent: "Info skickad",
  send_info: "Skicka info",
  interested: "Intresserad",
  meeting_booked: "Möte bokat",
  proposal_sent: "Offert skickad",
  closed_won: "Vunnen kund",
  closed_lost: "Förlorad",
  not_interested: "Inte intresserad",
  bad_fit: "Passar inte",
};

const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: "Utkast",
  generated: "Genererad",
  sent: "Skickad",
  viewed: "Visad",
  approved: "Godkänd",
  signed: "Signerad",
  declined: "Avböjd",
  expired: "Utgången",
};

function formatDate(iso?: string | null): string {
  if (!iso) return "okänt datum";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "okänt datum";
  return date.toLocaleDateString("sv-SE");
}

function formatAmount(amount?: number | null, currency = "SEK"): string {
  if (amount == null) return "—";
  return `${Number(amount).toLocaleString("sv-SE")} ${currency}`;
}

function line(label: string, value?: string | number | null): string | null {
  if (value === undefined || value === null || value === "") return null;
  return `- ${label}: ${value}`;
}

function section(title: string, body: string[]): string {
  return [
    `## ${title}`,
    ...(body.length ? body : ["_Inget registrerat._"]),
  ].join("\n");
}

function contactName(contact: Contact): string {
  return [contact.first_name, contact.last_name].filter(Boolean).join(" ");
}

export function buildCustomerProfile(data: CustomerProfileData): string {
  const {
    company,
    contacts,
    callLogs,
    deals,
    quotes,
    contactNotes,
    dealNotes,
    tasks,
    dealStages,
  } = data;

  const contactNameById = new Map(
    contacts.map((c) => [String(c.id), contactName(c)]),
  );
  const dealNameById = new Map(deals.map((d) => [String(d.id), d.name]));

  const companyLines = [
    line("Org.nr", company.org_number || company.tax_identifier),
    line("Bransch", company.industry || company.sector),
    line(
      "Adress",
      [company.address, company.zipcode, company.city]
        .filter(Boolean)
        .join(", "),
    ),
    line("Telefon", company.phone_number),
    line("E-post", company.email),
    line("Hemsida", company.website),
    line(
      "Hemsidekvalitet",
      company.has_website === false
        ? "Saknar hemsida"
        : company.website_quality,
    ),
    line(
      "Lead-status",
      company.lead_status
        ? LEAD_STATUS_LABELS[company.lead_status] || company.lead_status
        : null,
    ),
    line("Segment", company.segment),
    line("Källa", company.source),
    line("Beskrivning", company.description),
  ].filter(Boolean) as string[];

  const contactLines = contacts.map((c) => {
    const email = c.email_jsonb?.[0]?.email;
    const phone = c.phone_jsonb?.[0]?.number;
    const parts = [
      c.title,
      email,
      phone,
      c.background ? `Bakgrund: ${c.background}` : null,
    ].filter(Boolean);
    return `- **${contactName(c)}**${parts.length ? ` — ${parts.join(", ")}` : ""}`;
  });

  const callLogLines = callLogs.map((log) => {
    const outcome = OUTCOME_LABELS[log.call_outcome] || log.call_outcome;
    const note = log.notes?.trim() ? ` — ${log.notes.trim()}` : "";
    const followup = log.followup_date
      ? ` (uppföljning ${formatDate(log.followup_date)}${log.followup_note ? `: ${log.followup_note}` : ""})`
      : "";
    return `- ${formatDate(log.created_at)} · ${outcome}${note}${followup}`;
  });

  const dealLines = deals.map((deal) => {
    const stage = findDealLabel(dealStages, deal.stage) || deal.stage;
    return `- **${deal.name}** — fas: ${stage}, belopp: ${formatAmount(deal.amount)}${
      deal.category ? `, kategori: ${deal.category}` : ""
    } (uppdaterad ${formatDate(deal.updated_at)})`;
  });

  const quoteLines = quotes.map((quote) => {
    const status = QUOTE_STATUS_LABELS[quote.status] || quote.status;
    return `- ${quote.quote_number ? `${quote.quote_number} · ` : ""}**${quote.title}** — ${formatAmount(quote.total_amount, quote.currency)}, status: ${status} (${formatDate(quote.created_at)})`;
  });

  const noteLines = [
    ...contactNotes.map((note) => ({
      date: note.date,
      text: `- ${formatDate(note.date)} · Kontakt ${contactNameById.get(String(note.contact_id)) || note.contact_id}: ${note.text}`,
    })),
    ...dealNotes.map((note) => ({
      date: note.date,
      text: `- ${formatDate(note.date)} · Affär ${dealNameById.get(String(note.deal_id)) || note.deal_id}: ${note.text}`,
    })),
  ]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((n) => n.text);

  const taskLines = tasks.map((task) => {
    const status = task.done_date ? "✅ klar" : "⬜ öppen";
    const who = contactNameById.get(String(task.contact_id));
    return `- ${status} · ${task.text}${who ? ` (${who})` : ""} — förfaller ${formatDate(task.due_date)}`;
  });

  return [
    `# Kundbild: ${company.name}`,
    `_Exporterad från Axona CRM ${formatDate(new Date().toISOString())}. Underlag för mötesförberedelse._`,
    "",
    section("Företag", companyLines),
    "",
    section("Kontakter", contactLines),
    "",
    section("Samtalslogg (nyast först)", callLogLines),
    "",
    section("Affärer", dealLines),
    "",
    section("Offerter", quoteLines),
    "",
    section("Anteckningar (nyast först)", noteLines),
    "",
    section("Uppgifter", taskLines),
    "",
  ].join("\n");
}
