// Rewrites the files uploaded to the attachments bucket before it was hardened:
// each file gets an unguessable name (`<uuid>.<ext>`) and a content type a
// browser cannot run, and every reference to it (notes, avatars, logos,
// configuration) is updated. The old URLs stop working.
//
// Usage:
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<key> \
//     node ./scripts/rewrite-attachments.mjs [--dry-run]
//
// Run it after applying the migrations and deploying the edge functions. It is
// safe to run again: files that are already rewritten are skipped.
import { createClient } from "@supabase/supabase-js";

import {
  getSafeContentType,
  getStorageFileName,
} from "../supabase/functions/_shared/attachments.ts";

const BUCKET = process.env.VITE_ATTACHMENTS_BUCKET || "attachments";
const PAGE_SIZE = 1000;
const REMOVE_BATCH_SIZE = 100;
const REWRITTEN_NAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.[a-z0-9]{1,10})?$/;

// Every column that can hold uploaded files (same list as the `refs` of
// supabase/functions/delete_note_attachments/index.ts).
const REFERENCES = [
  { table: "contact_notes", column: "attachments" },
  { table: "deal_notes", column: "attachments" },
  { table: "companies", column: "logo" },
  { table: "contacts", column: "avatar" },
  { table: "sales", column: "avatar" },
  { table: "configuration", column: "config" },
];

const main = async () => {
  const isDryRun = process.argv.includes("--dry-run");
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to run this script",
    );
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const objects = (await listObjects(supabase)).filter(needsRewrite);
  log(`${objects.length} file(s) to rewrite in "${BUCKET}"`);
  if (objects.length === 0) return;

  // old name -> { name, type } of its rewritten copy
  const renames = new Map(
    objects.map((object) => [
      object.name,
      {
        name: getStorageFileName(object.name),
        type: getSafeContentType(object.metadata?.mimetype),
      },
    ]),
  );

  if (!isDryRun) {
    for (const object of objects) {
      await copyObject(supabase, object.name, renames.get(object.name));
    }
  }

  for (const reference of REFERENCES) {
    await rewriteReferences(supabase, reference, renames, isDryRun);
  }

  if (isDryRun) {
    for (const [oldName, { name, type }] of renames) {
      log(`  ${oldName} -> ${name} (${type})`);
    }
    log("Dry run: nothing was changed");
    return;
  }

  // Only now that nothing points to them anymore. Note triggers may already
  // have deleted some of them: removing a missing file is a no-op.
  const oldNames = [...renames.keys()];
  for (let i = 0; i < oldNames.length; i += REMOVE_BATCH_SIZE) {
    const { error } = await supabase.storage
      .from(BUCKET)
      .remove(oldNames.slice(i, i + REMOVE_BATCH_SIZE));
    if (error) throw new Error(`Failed to remove old files: ${error.message}`);
  }
  log(`Rewrote ${objects.length} file(s)`);
};

const listObjects = async (supabase) => {
  const objects = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list("", { limit: PAGE_SIZE, offset, sortBy: { column: "name" } });
    if (error) throw new Error(`Failed to list files: ${error.message}`);
    // Folders come back with a null id: the app never creates any.
    objects.push(...data.filter((object) => object.id != null));
    if (data.length < PAGE_SIZE) return objects;
  }
};

const needsRewrite = (object) =>
  !REWRITTEN_NAME.test(object.name) ||
  getSafeContentType(object.metadata?.mimetype) !== object.metadata?.mimetype;

const copyObject = async (supabase, oldName, { name, type }) => {
  const { data, error } = await supabase.storage.from(BUCKET).download(oldName);
  if (error) throw new Error(`Failed to download ${oldName}: ${error.message}`);
  // supabase-js uploads a Blob with its own type and ignores the contentType
  // option, so the content is wrapped in a Blob of the safe type.
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(name, new Blob([data], { type }));
  if (uploadError) {
    throw new Error(`Failed to upload ${name}: ${uploadError.message}`);
  }
};

const rewriteReferences = async (
  supabase,
  { table, column },
  renames,
  isDryRun,
) => {
  let count = 0;
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(`id, ${column}`)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Failed to read ${table}: ${error.message}`);

    for (const row of data) {
      const { value, isChanged } = rewriteValue(row[column], renames);
      if (!isChanged) continue;
      count++;
      if (isDryRun) continue;
      const { error: updateError } = await supabase
        .from(table)
        .update({ [column]: value })
        .eq("id", row.id);
      if (updateError) {
        throw new Error(
          `Failed to update ${table} ${row.id}: ${updateError.message}`,
        );
      }
    }
    if (data.length < PAGE_SIZE) break;
  }
  log(`${table}.${column}: ${count} row(s) to update`);
};

// Returns a copy of the value where every path or URL of a renamed file points
// to its new name. An object holding such a path also gets its `type` updated
// (the type of a note attachment decides how the app displays it).
const rewriteValue = (value, renames) => {
  if (typeof value === "string") {
    const rename = findRename(value, renames);
    return rename
      ? { value: rename.rewrite(value), isChanged: true, rename }
      : { value, isChanged: false };
  }
  if (Array.isArray(value)) {
    const results = value.map((item) => rewriteValue(item, renames));
    return {
      value: results.map((result) => result.value),
      isChanged: results.some((result) => result.isChanged),
    };
  }
  if (value != null && typeof value === "object") {
    const entries = Object.entries(value).map(([key, item]) => [
      key,
      rewriteValue(item, renames),
    ]);
    const rename = entries.find(([, result]) => result.rename)?.[1].rename;
    const rewritten = Object.fromEntries(
      entries.map(([key, result]) => [key, result.value]),
    );
    return {
      value:
        rename && typeof rewritten.type === "string"
          ? { ...rewritten, type: rename.type }
          : rewritten,
      isChanged: entries.some(([, result]) => result.isChanged),
    };
  }
  return { value, isChanged: false };
};

// Matches a bare path (`0.123.pdf`) or a URL ending with it, possibly
// URL-encoded (`.../attachments/0.123.my%20ext`).
const findRename = (text, renames) => {
  const lastSlash = text.lastIndexOf("/");
  const lastSegment = text.slice(lastSlash + 1).split(/[?#]/)[0];
  const rename = renames.get(safelyDecode(lastSegment));
  if (!rename) return null;
  return {
    type: rename.type,
    rewrite: (value) =>
      value.slice(0, lastSlash + 1) +
      rename.name +
      value.slice(lastSlash + 1 + lastSegment.length),
  };
};

const safelyDecode = (text) => {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
};

// eslint-disable-next-line no-console
const log = (...args) => console.log(...args);

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
