#!/usr/bin/env node
// Turn captured Notion page responses into one SQL file of evidence inserts.
//
// This script never contacts Notion and never prints page content. It reads
// raw responses that were already written to a directory OUTSIDE the repo,
// and emits SQL that the Supabase CLI applies to MAIN.
//
// Two things it is careful about:
//
//   1. It does not escape the content. Free-text applicant answers are full
//      of quotes, apostrophes, newlines and <br>, and escaping them 159
//      times is a good way to corrupt the evidence. Each value goes in a
//      dollar-quoted literal whose tag is checked to be absent from the
//      payload first.
//
//   2. It does not resolve application_id itself. The insert joins
//      historical_import_records on the Notion page id, so the database
//      makes the mapping from the provenance that already exists — there is
//      nothing here for a script to guess wrong.
//
// Usage:
//   node scripts/historical-import/captureNotionApplicationSnapshots.mjs \
//     <raw-dir> <out.sql>
//
// <raw-dir> holds one file per page, named <notion_page_id>.json, whose
// contents are the verbatim response text.

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PAGE_ID = /^[0-9a-f]{32}$/;

/** A dollar-quote tag that does not occur in the payload. */
const quote = (value, hint) => {
  for (let n = 0; n < 1000; n += 1) {
    const tag = `$${hint}${n}$`;
    if (!value.includes(tag)) return `${tag}${value}${tag}`;
  }
  throw new Error(`could not find a safe quote tag for ${hint}`);
};

/** Only the source's own statement about itself, never a guess. */
const lastEditedOf = (parsed) => {
  const value = parsed?.page_last_edited_at;
  return typeof value === "string" && value.length > 0 ? value : null;
};

export const buildStatement = (pageId, rawText) => {
  if (!PAGE_ID.test(pageId)) {
    throw new Error(`not a Notion page id: ${pageId}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (error) {
    throw new Error(`${pageId}: response is not valid JSON (${error.message})`);
  }

  const hash = createHash("sha256").update(rawText, "utf8").digest("hex");
  const lastEdited = lastEditedOf(parsed);
  const raw = quote(rawText, "evd");

  return {
    hash,
    lastEdited,
    sql: `
insert into public.historical_application_source_snapshots
  (application_id, source_system, source_url, notion_page_id,
   source_last_edited_at, raw_snapshot, raw_response_text, content_hash)
select h.entity_id::bigint,
       'notion',
       h.source_key,
       ${quote(pageId, "pid")},
       ${lastEdited === null ? "null" : `${quote(lastEdited, "led")}::timestamptz`},
       ${raw}::jsonb,
       ${raw},
       ${quote(hash, "sha")}
from public.historical_import_records h
where h.entity_table = 'applications'
  and split_part(h.source_key, '/', 4) = ${quote(pageId, "pid")}
on conflict (application_id, content_hash) do nothing;
`.trim(),
  };
};

const main = () => {
  const [rawDir, outFile] = process.argv.slice(2);
  if (!rawDir || !outFile) {
    console.error(
      "usage: captureNotionApplicationSnapshots.mjs <raw-dir> <out.sql>",
    );
    process.exit(1);
  }

  const files = readdirSync(rawDir)
    .filter((name) => name.endsWith(".json"))
    .sort();

  const statements = [];
  const hashes = new Map();
  const failures = [];

  for (const name of files) {
    const pageId = name.replace(/\.json$/, "");
    try {
      const rawText = readFileSync(join(rawDir, name), "utf8");
      const { sql, hash } = buildStatement(pageId, rawText);
      statements.push(sql);
      hashes.set(pageId, hash);
    } catch (error) {
      // Page id only. Never the content, never the applicant.
      failures.push(`${pageId}: ${error.message}`);
    }
  }

  const body = [
    "-- Generated. Contains real applicant PII: never commit this file.",
    "begin;",
    ...statements,
    "commit;",
    // The last statement is what the CLI returns, so make it the receipt.
    `select count(*) as snapshots_total,
            count(distinct application_id) as applications_covered,
            count(distinct content_hash) as distinct_hashes
     from public.historical_application_source_snapshots;`,
  ].join("\n\n");

  writeFileSync(outFile, `${body}\n`, "utf8");

  const duplicates =
    [...hashes.values()].length - new Set(hashes.values()).size;
  // stdout, not console.log: the summary IS this script's output, and it
  // is deliberately aggregate — counts, hashes and page ids, never a line
  // of anybody's answer.
  process.stdout.write(
    `${JSON.stringify(
      {
        files_read: files.length,
        statements_written: statements.length,
        distinct_hashes: new Set(hashes.values()).size,
        duplicate_hashes: duplicates,
        failures,
      },
      null,
      2,
    )}\n`,
  );
};

if (
  process.argv[1] &&
  process.argv[1].endsWith("captureNotionApplicationSnapshots.mjs")
) {
  main();
}
