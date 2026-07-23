// Resource registry — the whitelist of tables/views the API exposes, plus the
// per-resource column typing the query layer needs to (de)serialize rows.
//
//   table    : the underlying SQLite table (writes go here). For a `_summary`
//              view, `table` is the view itself (read-only).
//   readonly : reads allowed, writes rejected (views).
//   json     : columns stored as JSON text -> parsed to JS on read, stringified
//              on write (objects, and bigint[] arrays like tags/contact_ids).
//   bool     : columns stored as INTEGER 0/1 -> coerced to JS boolean on read,
//              and coerced back to 0/1 in filters and writes.
export const RESOURCES = {
  companies: {
    table: "companies",
    json: ["logo", "context_links"],
    bool: [],
  },
  companies_summary: {
    table: "companies_summary",
    readonly: true,
    json: ["logo", "context_links"],
    bool: [],
  },
  contacts: {
    table: "contacts",
    json: ["avatar", "email_jsonb", "phone_jsonb", "tags"],
    bool: ["has_newsletter"],
  },
  contacts_summary: {
    table: "contacts_summary",
    readonly: true,
    json: ["avatar", "email_jsonb", "phone_jsonb", "tags"],
    bool: ["has_newsletter"],
  },
  contact_notes: {
    table: "contact_notes",
    json: ["attachments"],
    bool: [],
  },
  deals: {
    table: "deals",
    json: ["contact_ids"],
    bool: [],
  },
  deal_notes: {
    table: "deal_notes",
    json: ["attachments"],
    bool: [],
  },
  sales: {
    table: "sales",
    json: ["avatar"],
    bool: ["administrator", "disabled"],
  },
  tags: {
    table: "tags",
    json: [],
    bool: [],
  },
  tasks: {
    table: "tasks",
    json: [],
    bool: [],
  },
  configuration: {
    table: "configuration",
    json: ["config"],
    bool: [],
  },
  favicons_excluded_domains: {
    table: "favicons_excluded_domains",
    json: [],
    bool: [],
  },
};

// Parent -> [ [childTable, childForeignKeyColumn], ... ] for explicit cascade
// deletes (mirrors the Postgres ON DELETE CASCADE relationships). Applied
// recursively so deleting a company also removes its contacts' notes & tasks.
export const CASCADE = {
  companies: [
    ["contacts", "company_id"],
    ["deals", "company_id"],
  ],
  contacts: [
    ["contact_notes", "contact_id"],
    ["tasks", "contact_id"],
  ],
  deals: [["deal_notes", "deal_id"]],
};
