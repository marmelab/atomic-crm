-- Atomic CRM — SQLite/libSQL schema (Turso)
--
-- Ported from supabase/schemas/{01_tables,03_views}.sql.
-- Postgres -> SQLite mapping:
--   bigint identity PK      -> INTEGER PRIMARY KEY AUTOINCREMENT
--   timestamptz             -> TEXT (ISO-8601 strings)
--   jsonb / json            -> TEXT (JSON, (de)serialized by the backend)
--   bigint[] (tags,...)     -> TEXT (JSON array of numbers)
--   citext (email,website)  -> TEXT COLLATE NOCASE
--   boolean                 -> INTEGER (0/1, coerced to JS boolean by the backend)
--
-- Row-Level Security, grants, triggers and plpgsql functions are intentionally
-- dropped: this is a single-user, no-login deployment (authorization lives in
-- the app), and cascade/side-effect logic lives in the backend + data provider.

PRAGMA foreign_keys = ON;

-- Companies -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    name           TEXT NOT NULL,
    sector         TEXT,
    size           INTEGER,
    linkedin_url   TEXT,
    website        TEXT COLLATE NOCASE,
    phone_number   TEXT,
    address        TEXT,
    zipcode        TEXT,
    city           TEXT,
    state_abbr     TEXT,
    sales_id       INTEGER,
    context_links  TEXT,          -- JSON array of strings
    country        TEXT,
    description    TEXT,
    revenue        TEXT,
    tax_identifier TEXT,
    logo           TEXT           -- JSON object (RAFile)
);

-- Contacts --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contacts (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name     TEXT,
    last_name      TEXT,
    gender         TEXT,
    title          TEXT,
    background     TEXT,
    avatar         TEXT,          -- JSON object (RAFile)
    first_seen     TEXT,
    last_seen      TEXT,
    has_newsletter INTEGER,       -- boolean
    status         TEXT,
    tags           TEXT,          -- JSON array of tag ids
    company_id     INTEGER REFERENCES companies(id) ON UPDATE CASCADE ON DELETE CASCADE,
    sales_id       INTEGER REFERENCES sales(id),
    linkedin_url   TEXT,
    email_jsonb    TEXT,          -- JSON array of {email,type}
    phone_jsonb    TEXT           -- JSON array of {number,type}
);

-- Contact notes ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contact_notes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id  INTEGER NOT NULL REFERENCES contacts(id) ON UPDATE CASCADE ON DELETE CASCADE,
    text        TEXT,
    date        TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    sales_id    INTEGER REFERENCES sales(id) ON UPDATE CASCADE ON DELETE CASCADE,
    status      TEXT,
    attachments TEXT              -- JSON array of RAFile
);

-- Deals -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS deals (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    name                  TEXT NOT NULL,
    company_id            INTEGER REFERENCES companies(id) ON UPDATE CASCADE ON DELETE CASCADE,
    contact_ids           TEXT,   -- JSON array of contact ids
    category              TEXT,
    stage                 TEXT NOT NULL,
    description           TEXT,
    amount                INTEGER,
    created_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    archived_at           TEXT,
    expected_closing_date TEXT,
    sales_id              INTEGER REFERENCES sales(id),
    "index"               INTEGER
);

-- Deal notes ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS deal_notes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    deal_id     INTEGER NOT NULL REFERENCES deals(id) ON UPDATE CASCADE ON DELETE CASCADE,
    type        TEXT,
    text        TEXT,
    date        TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    sales_id    INTEGER REFERENCES sales(id),
    attachments TEXT              -- JSON array of RAFile
);

-- Sales (users) ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name    TEXT NOT NULL DEFAULT 'Pending',
    last_name     TEXT NOT NULL DEFAULT 'Pending',
    email         TEXT NOT NULL COLLATE NOCASE,
    administrator INTEGER NOT NULL DEFAULT 0,   -- boolean
    user_id       TEXT,                          -- legacy Supabase auth id (unused, kept for shape)
    avatar        TEXT,                          -- JSON object (RAFile)
    disabled      INTEGER NOT NULL DEFAULT 0     -- boolean
);

-- Tags ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tags (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT NOT NULL,
    color TEXT NOT NULL
);

-- Tasks -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON UPDATE CASCADE ON DELETE CASCADE,
    type       TEXT,
    text       TEXT,
    due_date   TEXT,
    done_date  TEXT,
    sales_id   INTEGER
);

-- Configuration (singleton row id=1) ------------------------------------------
CREATE TABLE IF NOT EXISTS configuration (
    id     INTEGER PRIMARY KEY CHECK (id = 1),
    config TEXT NOT NULL DEFAULT '{}'          -- JSON object
);

-- Favicons excluded domains ---------------------------------------------------
CREATE TABLE IF NOT EXISTS favicons_excluded_domains (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT NOT NULL
);

-- Indexes on foreign keys -----------------------------------------------------
CREATE INDEX IF NOT EXISTS contact_notes_contact_id_idx ON contact_notes (contact_id);
CREATE INDEX IF NOT EXISTS contacts_company_id_idx      ON contacts (company_id);
CREATE INDEX IF NOT EXISTS deal_notes_deal_id_idx        ON deal_notes (deal_id);
CREATE INDEX IF NOT EXISTS deals_company_id_idx          ON deals (company_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq__sales__email       ON sales (email);

-- Views -----------------------------------------------------------------------
-- companies_summary: adds aggregate contact/deal counts.
DROP VIEW IF EXISTS companies_summary;
CREATE VIEW companies_summary AS
SELECT
    c.*,
    (SELECT count(*) FROM deals    d  WHERE d.company_id  = c.id) AS nb_deals,
    (SELECT count(*) FROM contacts co WHERE co.company_id = c.id) AS nb_contacts
FROM companies c;

-- contacts_summary: adds company_name, open-task count, and full-text search
-- helper columns extracted from the email/phone JSON arrays.
DROP VIEW IF EXISTS contacts_summary;
CREATE VIEW contacts_summary AS
SELECT
    co.*,
    (SELECT group_concat(json_extract(je.value, '$.email'), ' ')
       FROM json_each(CASE WHEN json_valid(co.email_jsonb) THEN co.email_jsonb ELSE '[]' END) je
    ) AS email_fts,
    (SELECT group_concat(json_extract(je.value, '$.number'), ' ')
       FROM json_each(CASE WHEN json_valid(co.phone_jsonb) THEN co.phone_jsonb ELSE '[]' END) je
    ) AS phone_fts,
    (SELECT cmp.name FROM companies cmp WHERE cmp.id = co.company_id) AS company_name,
    (SELECT count(*) FROM tasks t WHERE t.contact_id = co.id AND t.done_date IS NULL) AS nb_tasks
FROM contacts co;
