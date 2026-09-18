// Synthetic-fixture tests only — no real applicant answers. The payloads
// below are invented, and deliberately contain the characters that make
// naive SQL escaping fail: single quotes, double quotes, backslashes,
// newlines and the <br> separators the real source uses.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import { buildStatement } from "./captureNotionApplicationSnapshots.mjs";

const PAGE_ID = "3b2f43aea3ef817a806df4050da701c9";

const response = (overrides = {}) =>
  JSON.stringify({
    metadata: { type: "page" },
    page_last_edited_at: "2026-08-04T16:56:46.204Z",
    text: `<properties>{"1. What's the pattern?":"It's \\"complicated\\".<br>Line two.\\nLine three."}</properties>`,
    ...overrides,
  });

test("hashes the bytes received, not the parsed object", () => {
  // Arrange
  const raw = response();

  // Act
  const { hash } = buildStatement(PAGE_ID, raw);

  // Assert
  assert.equal(hash, createHash("sha256").update(raw, "utf8").digest("hex"));
  assert.match(hash, /^[0-9a-f]{64}$/);
});

test("identical bytes hash identically, so a re-capture is a no-op", () => {
  // Arrange / Act
  const first = buildStatement(PAGE_ID, response());
  const second = buildStatement(PAGE_ID, response());

  // Assert
  assert.equal(first.hash, second.hash);
  assert.match(
    first.sql,
    /on conflict \(application_id, content_hash\) do nothing/,
  );
});

test("changed source content hashes differently, so both states survive", () => {
  // Arrange — the same page, edited upstream.
  const before = buildStatement(PAGE_ID, response());
  const after = buildStatement(
    PAGE_ID,
    response({ page_last_edited_at: "2026-09-01T00:00:00.000Z" }),
  );

  // Assert
  assert.notEqual(before.hash, after.hash);
});

test("quotes content without escaping it, apostrophes and all", () => {
  // Arrange
  const raw = response();

  // Act
  const { sql } = buildStatement(PAGE_ID, raw);

  // Assert — the payload appears verbatim, byte for byte.
  assert.ok(sql.includes(raw));
  // The apostrophe is what a naive escape would double, and the <br> the
  // real source uses must survive untouched.
  assert.ok(raw.includes("It's"));
  assert.ok(sql.includes("It's"));
  assert.ok(!sql.includes("It''s"));
  assert.ok(sql.includes("<br>"));
});

test("picks a quote tag the payload cannot terminate", () => {
  // Arrange — a payload that already contains the first tag it would try.
  const hostile = JSON.stringify({ text: "$evd0$ and $evd1$ both appear" });

  // Act
  const { sql } = buildStatement(PAGE_ID, hostile);

  // Assert — it moved on to a tag that is genuinely absent.
  assert.ok(sql.includes("$evd2$"));
  assert.ok(sql.includes(hostile));
});

test("records the source's own last-edited time, and never invents one", () => {
  // Arrange / Act
  const stated = buildStatement(PAGE_ID, response());
  const silent = buildStatement(
    PAGE_ID,
    response({ page_last_edited_at: null }),
  );

  // Assert
  assert.equal(stated.lastEdited, "2026-08-04T16:56:46.204Z");
  assert.equal(silent.lastEdited, null);
  assert.match(silent.sql, /\n\s+null,/);
});

test("lets the database resolve the application from existing provenance", () => {
  // Arrange / Act — nothing here decides which Application a page belongs
  // to; the insert joins historical_import_records on the page id.
  const { sql } = buildStatement(PAGE_ID, response());

  // Assert
  assert.match(sql, /from public\.historical_import_records h/);
  assert.match(sql, /split_part\(h\.source_key, '\/', 4\) = /);
  assert.ok(!/application_id\s*=\s*\d/.test(sql));
});

test("refuses anything that is not a Notion page id", () => {
  // Arrange / Act / Assert
  assert.throws(
    () => buildStatement("../../etc/passwd", response()),
    /page id/,
  );
  assert.throws(() => buildStatement("SHORT", response()), /page id/);
});

test("refuses a response that is not valid JSON", () => {
  // Arrange / Act / Assert
  assert.throws(() => buildStatement(PAGE_ID, "not json"), /valid JSON/);
});
