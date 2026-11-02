/**
 * Pure lead-import helpers: column mapping, phone / email normalization,
 * company domain extraction and the rejects CSV. The database
 * (`import_leads()`) re-validates and owns deduplication against existing
 * leads; these run first so a user sees invalid rows before anything is sent.
 */

export interface LeadImportRow {
  /** 1-based data row number in the file (the header is row 0). */
  row: number;
  company_name: string;
  first_name: string;
  last_name: string;
  title: string;
  /** E.164 (`+919876543210`), or empty. */
  phone: string;
  email: string;
  industry: string;
  pitch: string;
  /** Company domain (`acme.com`), from the website or a business email. */
  domain: string;
}

export type LeadImportStatus = "created" | "duplicate" | "invalid";

export interface LeadImportReportRow {
  row: number;
  status: LeadImportStatus;
  reason?: string;
  contact_id?: number | string | null;
}

export interface LeadImportResult {
  batch_id: number | string | null;
  created: number;
  duplicates: number;
  invalid: number;
  rows: LeadImportReportRow[];
}

/** Accepted header names (lowercased, spaces / dashes as underscores). */
const COLUMN_ALIASES: Record<keyof Omit<LeadImportRow, "row">, string[]> = {
  company_name: [
    "company_name",
    "company",
    "business_name",
    "business",
    "organization",
    "account",
  ],
  first_name: ["first_name", "firstname", "given_name"],
  last_name: ["last_name", "lastname", "surname", "family_name"],
  title: ["title", "job_title", "designation", "position"],
  phone: [
    "phone",
    "phone_number",
    "mobile",
    "mobile_number",
    "contact_number",
    "whatsapp",
    "whatsapp_number",
  ],
  email: ["email", "email_address", "e_mail", "mail"],
  industry: ["industry", "sector", "vertical", "category"],
  pitch: ["pitch", "pitch_script", "pitch_point", "script", "notes"],
  domain: ["domain", "website", "company_website", "url", "web"],
};
const FULL_NAME_ALIASES = [
  "name",
  "contact_name",
  "contact",
  "full_name",
  "person",
];

/** Free mail providers never identify a company. */
const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.in",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "icloud.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "rediffmail.com",
  "zoho.com",
]);

const normalizeHeader = (header: string) =>
  header
    .trim()
    .toLowerCase()
    .replace(/[\s\-.]+/g, "_");

const pick = (record: Record<string, string>, aliases: string[]) => {
  for (const alias of aliases) {
    const value = record[alias];
    if (value != null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
};

export type PhoneResult = { phone: string } | { error: string };

/**
 * Normalizes a phone number to E.164. Numbers without a country code are
 * read as Indian (`defaultCountryCode`). Covers: `98765 43210`,
 * `098765-43210`, `91 9876543210`, `+91 98765 43210`, `0091 9876543210` and
 * any `+<country><number>` of 8 to 15 digits. It does not validate each
 * country's numbering plan.
 */
export const normalizePhone = (
  raw: string,
  defaultCountryCode = "91",
): PhoneResult => {
  const trimmed = raw.trim();
  if (!trimmed) return { error: "missing phone" };
  if (/[a-z]/i.test(trimmed.replace(/(ext|x)\.?\s*\d+$/i, ""))) {
    return { error: "invalid phone" };
  }
  const hasPlus = trimmed.startsWith("+");
  let digits = trimmed.replace(/\D/g, "");

  if (!hasPlus && digits.startsWith("00")) {
    digits = digits.slice(2);
    return toE164(digits);
  }
  if (hasPlus) return toE164(digits);

  if (defaultCountryCode === "91") {
    if (digits.length === 11 && digits.startsWith("0"))
      digits = digits.slice(1);
    if (digits.length === 10) {
      return /^[6-9]/.test(digits)
        ? { phone: `+91${digits}` }
        : { error: "invalid phone" };
    }
    if (digits.length === 12 && digits.startsWith("91")) {
      return /^91[6-9]/.test(digits)
        ? { phone: `+${digits}` }
        : { error: "invalid phone" };
    }
    return { error: "invalid phone" };
  }
  return toE164(`${defaultCountryCode}${digits.replace(/^0+/, "")}`);
};

const toE164 = (digits: string): PhoneResult =>
  /^[1-9]\d{7,14}$/.test(digits)
    ? { phone: `+${digits}` }
    : { error: "invalid phone" };

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const normalizeEmail = (raw: string) => raw.trim().toLowerCase();

export const isValidEmail = (email: string) => EMAIL_PATTERN.test(email);

/** `https://www.acme.com/about` -> `acme.com`. */
export const domainFromWebsite = (website: string) => {
  const host = website
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/:?#]/)[0];
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) ? host : "";
};

/** Company domain of a business email; empty for free mail providers. */
export const domainFromEmail = (email: string) => {
  const domain = email.split("@")[1] ?? "";
  return domain && !FREE_EMAIL_DOMAINS.has(domain) ? domain : "";
};

const splitFullName = (fullName: string) => {
  const parts = fullName.split(/\s+/).filter(Boolean);
  return {
    first_name: parts[0] ?? "",
    last_name: parts.slice(1).join(" "),
  };
};

/**
 * Maps one parsed CSV record to a lead row, or to the reason it is invalid.
 */
export const mapLeadRecord = (
  rawRecord: Record<string, unknown>,
  row: number,
): { lead: LeadImportRow } | { invalid: LeadImportReportRow } => {
  const record: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawRecord)) {
    record[normalizeHeader(key)] = value == null ? "" : String(value);
  }

  let first_name = pick(record, COLUMN_ALIASES.first_name);
  let last_name = pick(record, COLUMN_ALIASES.last_name);
  if (!first_name && !last_name) {
    ({ first_name, last_name } = splitFullName(
      pick(record, FULL_NAME_ALIASES),
    ));
  }
  const company_name = pick(record, COLUMN_ALIASES.company_name);
  const rawPhone = pick(record, COLUMN_ALIASES.phone);
  const email = normalizeEmail(pick(record, COLUMN_ALIASES.email));

  const invalid = (reason: string) => ({
    invalid: { row, status: "invalid" as const, reason },
  });

  if (!company_name) return invalid("missing company name");
  if (!first_name && !last_name) return invalid("missing contact name");
  if (!rawPhone && !email) return invalid("missing phone and email");

  let phone = "";
  if (rawPhone) {
    const result = normalizePhone(rawPhone);
    if ("error" in result) return invalid(`${result.error}: ${rawPhone}`);
    phone = result.phone;
  }
  if (email && !isValidEmail(email)) return invalid(`invalid email: ${email}`);

  return {
    lead: {
      row,
      company_name,
      first_name,
      last_name,
      title: pick(record, COLUMN_ALIASES.title),
      phone,
      email,
      industry: pick(record, COLUMN_ALIASES.industry),
      pitch: pick(record, COLUMN_ALIASES.pitch),
      domain:
        domainFromWebsite(pick(record, COLUMN_ALIASES.domain)) ||
        (email ? domainFromEmail(email) : ""),
    },
  };
};

/** Splits parsed records into rows to send and rows already rejected. */
export const prepareLeadRecords = (records: Record<string, unknown>[]) => {
  const leads: LeadImportRow[] = [];
  const invalid: LeadImportReportRow[] = [];
  records.forEach((record, index) => {
    const result = mapLeadRecord(record, index + 1);
    if ("lead" in result) leads.push(result.lead);
    else invalid.push(result.invalid);
  });
  return { leads, invalid };
};

/** Merges client-side rejects into the server report, ordered by row. */
export const mergeReports = (
  server: LeadImportResult,
  clientInvalid: LeadImportReportRow[],
): LeadImportResult => ({
  ...server,
  invalid: server.invalid + clientInvalid.length,
  rows: [...server.rows, ...clientInvalid].sort((a, b) => a.row - b.row),
});

const csvCell = (value: unknown) => {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * The rejected (duplicate and invalid) source rows, with their status and
 * reason in front, as a CSV the user can fix and import again.
 */
export const rejectsToCsv = (
  report: LeadImportReportRow[],
  records: Record<string, unknown>[],
) => {
  const rejected = report.filter((row) => row.status !== "created");
  const headers = Array.from(
    new Set(records.flatMap((record) => Object.keys(record))),
  );
  const lines = [
    ["row", "status", "reason", ...headers].map(csvCell).join(","),
    ...rejected.map((row) => {
      const record = records[row.row - 1] ?? {};
      return [
        row.row,
        row.status,
        row.reason ?? "",
        ...headers.map((header) => record[header]),
      ]
        .map(csvCell)
        .join(",");
    }),
  ];
  return lines.join("\n");
};
