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
  ])("rejects %s", (_label, sql) => {
    expect(validateReadOnly(sql)).not.toBeNull();
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
  ])("rejects %s", (_label, sql) => {
    expect(validateWrite(sql)).not.toBeNull();
  });
});
