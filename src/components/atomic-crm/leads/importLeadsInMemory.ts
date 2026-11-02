import type { DataProvider, Identifier } from "ra-core";

import { openColdDeal } from "../providers/commons/companyContacts";
import type { Company, Contact, ImportBatch } from "../types";
import { domainFromWebsite } from "./leadImport";
import type {
  LeadImportReportRow,
  LeadImportResult,
  LeadImportRow,
} from "./leadImport";

const ALL = { page: 1, perPage: 100_000 };

const sectorSlug = (industry: string) =>
  industry
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * Demo-mode (FakeRest) twin of the `import_leads()` Postgres function, with
 * the same rules: a lead whose phone or email already exists (in the CRM or
 * earlier in the file) is a duplicate; a company with the same domain or name
 * is reused; new leads enter the pool as `lead_stage = new`. Not
 * transactional, like the rest of the demo backend.
 */
export const importLeadsInMemory = async (
  dataProvider: DataProvider,
  fileName: string,
  rows: LeadImportRow[],
  salesId?: Identifier,
): Promise<LeadImportResult> => {
  const [{ data: contacts }, { data: companies }] = await Promise.all([
    dataProvider.getList<Contact>("contacts", {
      pagination: ALL,
      sort: { field: "id", order: "ASC" },
      filter: {},
    }),
    dataProvider.getList<Company>("companies", {
      pagination: ALL,
      sort: { field: "id", order: "ASC" },
      filter: {},
    }),
  ]);

  const knownPhones = new Map<string, Identifier>();
  const knownEmails = new Map<string, Identifier>();
  for (const contact of contacts) {
    if (contact.phone_e164) knownPhones.set(contact.phone_e164, contact.id);
    for (const { email } of contact.email_jsonb ?? []) {
      if (email) knownEmails.set(email.toLowerCase(), contact.id);
    }
  }
  const companyByKey = new Map<string, Company>();
  for (const company of companies) {
    if (company.website) {
      companyByKey.set(`domain:${domainFromWebsite(company.website)}`, company);
    }
    companyByKey.set(`name:${company.name.toLowerCase()}`, company);
  }
  const companiesWithPrimary = new Set(
    contacts
      .filter((contact) => contact.is_primary && contact.company_id != null)
      .map((contact) => String(contact.company_id)),
  );

  const { data: batch } = await dataProvider.create<ImportBatch>(
    "import_batches",
    {
      data: {
        created_at: new Date().toISOString(),
        created_by: salesId ?? null,
        file_name: fileName,
        total_rows: rows.length,
        created_count: 0,
        duplicate_count: 0,
        invalid_count: 0,
      },
    },
  );

  const seenPhones = new Set<string>();
  const seenEmails = new Set<string>();
  const report: LeadImportReportRow[] = [];
  for (const lead of rows) {
    // An empty email is not a match. `"" && map.get("")` is `""`, and
    // `"" != null`, which would mark every phone-only row as a duplicate.
    const existingId =
      (lead.phone ? knownPhones.get(lead.phone) : undefined) ??
      (lead.email ? knownEmails.get(lead.email) : undefined);
    if (
      existingId != null ||
      (lead.phone && seenPhones.has(lead.phone)) ||
      (lead.email && seenEmails.has(lead.email))
    ) {
      report.push({
        row: lead.row,
        status: "duplicate",
        reason:
          existingId == null ? "duplicate in file" : "matches an existing lead",
        contact_id: existingId ?? null,
      });
      continue;
    }

    const sector = lead.industry ? sectorSlug(lead.industry) : null;
    let company =
      (lead.domain && companyByKey.get(`domain:${lead.domain}`)) ||
      companyByKey.get(`name:${lead.company_name.toLowerCase()}`);
    if (!company) {
      const now = new Date().toISOString();
      ({ data: company } = await dataProvider.create<Company>("companies", {
        data: {
          name: lead.company_name,
          sector,
          pitch_point: lead.pitch || null,
          website: lead.domain ? `https://${lead.domain}` : "",
          lead_date: now.slice(0, 10),
          created_at: now,
          sales_id: salesId,
          nb_contacts: 0,
          nb_deals: 0,
        },
      }));
      if (lead.domain) companyByKey.set(`domain:${lead.domain}`, company);
      companyByKey.set(`name:${company.name.toLowerCase()}`, company);
    }

    const now = new Date().toISOString();
    const isPrimary = !companiesWithPrimary.has(String(company.id));
    const { data: contact } = await dataProvider.create<Contact>("contacts", {
      data: {
        first_name: lead.first_name,
        last_name: lead.last_name,
        title: lead.title,
        company_id: company.id,
        email_jsonb: lead.email ? [{ email: lead.email, type: "Work" }] : [],
        phone_jsonb: lead.phone ? [{ number: lead.phone, type: "Work" }] : [],
        phone_e164: lead.phone || null,
        whatsapp_number: lead.phone || null,
        is_primary: isPrimary,
        lead_stage: "new",
        retry_count: 0,
        import_batch_id: batch.id,
        first_seen: now,
        last_seen: now,
        tags: [],
        sales_id: salesId,
      },
    });
    if (isPrimary) companiesWithPrimary.add(String(company.id));
    await openColdDeal(
      dataProvider,
      company.id,
      [contact.id],
      salesId ?? company.sales_id,
      company.name,
    );
    if (lead.phone) seenPhones.add(lead.phone);
    if (lead.email) seenEmails.add(lead.email);
    report.push({ row: lead.row, status: "created", contact_id: contact.id });
  }

  const count = (status: LeadImportReportRow["status"]) =>
    report.filter((row) => row.status === status).length;
  const result: LeadImportResult = {
    batch_id: batch.id,
    created: count("created"),
    duplicates: count("duplicate"),
    invalid: 0,
    rows: report,
  };
  await dataProvider.update<ImportBatch>("import_batches", {
    id: batch.id,
    data: {
      created_count: result.created,
      duplicate_count: result.duplicates,
    },
    previousData: batch,
  });
  return result;
};
