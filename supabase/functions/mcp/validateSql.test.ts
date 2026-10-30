// @vitest-environment node
import { describe, it, expect } from "vitest";
import { validateReadOnly, validateWrite } from "./validateSql";

describe("validateReadOnly", () => {
  it.each([
    ["simple SELECT", "SELECT * FROM contacts"],
    [
      "SELECT with WHERE",
      "SELECT id, name FROM contacts WHERE created_at > NOW() - INTERVAL '30 days'",
    ],
    [
      "SELECT with JOIN",
      "SELECT c.name, co.name FROM contacts c JOIN companies co ON c.company_id = co.id",
    ],
    [
      "SELECT with subquery",
      "SELECT * FROM contacts WHERE company_id IN (SELECT id FROM companies WHERE sector = 'Tech')",
    ],
    [
      "read-only CTE",
      "WITH recent AS (SELECT * FROM contacts WHERE created_at > NOW() - INTERVAL '7 days') SELECT * FROM recent",
    ],
    [
      "aggregate query",
      "SELECT COUNT(*) as total, type FROM tasks GROUP BY type",
    ],
    [
      "window function",
      "SELECT id, row_number() OVER (PARTITION BY company_id ORDER BY created_at) FROM contacts",
    ],
    ["DISTINCT ON a column", "SELECT DISTINCT ON (company_id) * FROM contacts"],
    [
      "DELETE in string literal",
      "SELECT * FROM contacts WHERE status = 'DELETE'",
    ],
    [
      "DROP in string literal",
      "SELECT * FROM logs WHERE message = 'DROP TABLE failed'",
    ],
    [
      "UPDATE in string literal",
      "SELECT * FROM contacts WHERE note = 'Please UPDATE your info'",
    ],
    [
      "DROP in block comment",
      "SELECT /* DROP TABLE contacts */ * FROM contacts",
    ],
    ["DROP in line comment", "SELECT * FROM contacts -- DROP TABLE contacts"],
    ["auth schema function", "SELECT * FROM tasks WHERE sales_id = auth.uid()"],
    ["pg_catalog schema function", "SELECT pg_catalog.now()"],
    ["public schema function", "SELECT public.search_query('john')"],
    ["public schema table", "SELECT id FROM public.contacts"],
    ["pg_catalog table", "SELECT relname FROM pg_catalog.pg_class"],
    [
      "information_schema view",
      "SELECT table_name FROM information_schema.tables",
    ],
    [
      // Not the validator's job: the transaction wrapper sets search_path to
      // `public`, so this name does not resolve and Postgres rejects it.
      "unqualified http extension function",
      "SELECT * FROM http_get('http://127.0.0.1/')",
    ],
  ])("allows %s", (_label, sql) => {
    expect(validateReadOnly(sql)).toBeNull();
  });

  it.each([
    ["INSERT", "INSERT INTO contacts (name) VALUES ('test')"],
    ["UPDATE", "UPDATE contacts SET name = 'test'"],
    ["DELETE", "DELETE FROM contacts WHERE id = 1"],
    [
      "writable CTE (DELETE)",
      "WITH d AS (DELETE FROM contacts RETURNING *) SELECT * FROM d",
    ],
    [
      "writable CTE (UPDATE)",
      "WITH u AS (UPDATE contacts SET name = 'x' RETURNING *) SELECT * FROM u",
    ],
    [
      "writable CTE (INSERT)",
      "WITH i AS (INSERT INTO contacts (name) VALUES ('x') RETURNING *) SELECT * FROM i",
    ],
    ["DROP TABLE", "DROP TABLE contacts"],
    ["CREATE TABLE", "CREATE TABLE evil (id int)"],
    ["ALTER TABLE", "ALTER TABLE contacts ADD COLUMN x int"],
    ["TRUNCATE", "TRUNCATE contacts"],
    ["SET", "SET LOCAL role = 'postgres'"],
    ["DO block", "DO $$ BEGIN END $$"],
    ["multi-statement (SELECT; DROP)", "SELECT 1; DROP TABLE contacts"],
    ["multi-statement (SELECT; SET)", "SELECT 1; SET LOCAL role = 'postgres'"],
    ["multi-statement (two SELECTs)", "SELECT 1; SELECT 2"],
    ["unparseable SQL", "NOT VALID SQL %%%"],
    [
      "set_config in a CTE (claims impersonation)",
      "WITH x AS (SELECT set_config('request.jwt.claims', '{\"sub\":\"other\"}', true)) SELECT * FROM x, contacts",
    ],
    [
      "set_config as a table function",
      "SELECT * FROM set_config('role', 'postgres', true)",
    ],
    [
      "schema-qualified, uppercase set_config",
      "SELECT pg_catalog.SET_CONFIG('role', 'postgres', true)",
    ],
    [
      "set_config in a subquery",
      "SELECT id FROM contacts WHERE first_name = (SELECT set_config('role', 'postgres', true))",
    ],
    [
      "set_config in DISTINCT ON (role escalation)",
      "SELECT DISTINCT ON (set_config('role', 'service_role', false)) 1",
    ],
    [
      "set_config in DISTINCT ON (claims impersonation)",
      "SELECT DISTINCT ON (set_config('request.jwt.claims', '{\"sub\":\"other\"}', true)) 1",
    ],
    [
      "set_config in OVER (PARTITION BY)",
      "SELECT count(*) OVER (PARTITION BY set_config('role', 'service_role', true)) FROM contacts",
    ],
    [
      "set_config in OVER (ORDER BY)",
      "SELECT count(*) OVER (ORDER BY set_config('role', 'service_role', true)) FROM contacts",
    ],
    [
      "http extension as a table function (SSRF)",
      "SELECT * FROM extensions.http_get('http://169.254.169.254/latest/meta-data/')",
    ],
    [
      "http extension in an expression (SSRF)",
      "SELECT extensions.http_get('http://127.0.0.1:54321/')",
    ],
    [
      "http extension POST (SSRF)",
      "SELECT content FROM extensions.http_post('http://127.0.0.1/', 'a', 'text/plain')",
    ],
    ["pg_net function (SSRF)", "SELECT net.http_get('http://127.0.0.1/')"],
    [
      "uppercase schema qualification",
      "SELECT * FROM EXTENSIONS.HTTP_GET('http://127.0.0.1/')",
    ],
    [
      "pg_net response table (SSRF read-back)",
      "SELECT status_code, content FROM net._http_response",
    ],
    [
      "pg_net table in a JOIN",
      "SELECT c.id FROM contacts c JOIN net._http_response r ON r.id = c.id",
    ],
    [
      "pg_net table in a CTE",
      "WITH r AS (SELECT content FROM net._http_response) SELECT * FROM r",
    ],
    [
      "pg_net table in a subquery",
      "SELECT (SELECT content FROM net._http_response LIMIT 1)",
    ],
    ["extension-schema type in a cast", "SELECT 'x'::extensions.citext"],
  ])("rejects %s", (_label, sql) => {
    expect(validateReadOnly(sql)).not.toBeNull();
  });

  it("names the offending schema-qualified reference", () => {
    expect(
      validateReadOnly("SELECT * FROM extensions.http_get('http://x/')"),
    ).toMatch(/"extensions\.http_get" is not allowed/);
    expect(validateReadOnly("SELECT * FROM net._http_response")).toMatch(
      /"net\._http_response" is not allowed/,
    );
  });
});

describe("validateWrite", () => {
  it.each([
    [
      "INSERT",
      "INSERT INTO contacts (first_name, last_name) VALUES ('John', 'Doe')",
    ],
    ["UPDATE", "UPDATE contacts SET name = 'test' WHERE id = 1"],
    ["DELETE", "DELETE FROM contacts WHERE id = 1"],
    [
      "INSERT with RETURNING",
      "INSERT INTO contacts (name) VALUES ('test') RETURNING id",
    ],
    [
      "UPDATE with subquery",
      "UPDATE contacts SET company_id = (SELECT id FROM companies WHERE name = 'Acme') WHERE id = 1",
    ],
    [
      "writable CTE with INSERT",
      "WITH d AS (DELETE FROM old_contacts RETURNING *) INSERT INTO archive SELECT * FROM d",
    ],
    [
      "UPDATE scoped to the caller",
      "UPDATE tasks SET done_date = now() WHERE id = 1 AND sales_id = auth.uid()",
    ],
    [
      "INSERT into a public-qualified table",
      "INSERT INTO public.tasks (text) VALUES ('x')",
    ],
  ])("allows %s", (_label, sql) => {
    expect(validateWrite(sql)).toBeNull();
  });

  it.each([
    ["standalone SELECT", "SELECT * FROM contacts"],
    ["DROP TABLE", "DROP TABLE contacts"],
    ["CREATE TABLE", "CREATE TABLE evil (id int)"],
    ["TRUNCATE", "TRUNCATE contacts"],
    ["SET", "SET LOCAL role = 'postgres'"],
    [
      "multi-statement (DELETE; DROP)",
      "DELETE FROM contacts; DROP TABLE contacts",
    ],
    [
      "multi-statement (DELETE; SET)",
      "DELETE FROM contacts; SET LOCAL role = 'postgres'",
    ],
    ["unparseable SQL", "NOT VALID SQL %%%"],
    [
      "set_config in an upsert (admin impersonation)",
      "INSERT INTO configuration (id, config) VALUES (1, to_jsonb(set_config('request.jwt.claims', '{\"sub\":\"admin-id\"}', true))) ON CONFLICT (id) DO UPDATE SET config = '{}' RETURNING id",
    ],
    [
      "set_config in an UPDATE",
      "UPDATE tasks SET text = set_config('role', 'postgres', true) WHERE id = 1",
    ],
    [
      "set_config in the DISTINCT ON of an INSERT ... SELECT",
      "INSERT INTO contacts (first_name) SELECT DISTINCT ON (set_config('role', 'service_role', true)) 'x'",
    ],
    [
      "http extension in an UPDATE (SSRF)",
      "UPDATE tasks SET text = (SELECT content FROM extensions.http_get('http://127.0.0.1/')) WHERE id = 1",
    ],
    [
      "pg_net in an INSERT ... SELECT (SSRF)",
      "INSERT INTO tasks (text) SELECT net.http_get('http://127.0.0.1/')::text",
    ],
    [
      "direct INSERT into the pg_net request queue (SSRF)",
      "INSERT INTO net.http_request_queue (method, url, headers, timeout_milliseconds) VALUES ('GET', 'http://169.254.169.254/latest/meta-data/', '{}', 5000)",
    ],
    [
      "writable CTE into the pg_net request queue (SSRF)",
      "WITH q AS (INSERT INTO net.http_request_queue (method, url, headers, timeout_milliseconds) VALUES ('GET', 'http://127.0.0.1/', '{}', 5000) RETURNING id) INSERT INTO tasks (text) SELECT id::text FROM q",
    ],
    [
      "UPDATE on a pg_net table",
      "UPDATE net.http_request_queue SET url = 'http://127.0.0.1/' WHERE id = 1",
    ],
    ["DELETE on a pg_net table", "DELETE FROM net._http_response WHERE id = 1"],
  ])("rejects %s", (_label, sql) => {
    expect(validateWrite(sql)).not.toBeNull();
  });
});
