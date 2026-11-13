// Retypes the files uploaded to the attachments bucket before it was hardened:
// each file served with a type a browser can run (e.g. an SVG running a
// script) is uploaded again under the same name as application/octet-stream,
// and the notes that hold it get the new type. File URLs do not change.
//
// Usage:
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<key> \
//     node ./scripts/retype-attachments.mjs [--dry-run]
//
// Run it after applying the migrations. It is safe to run again: files that
// already have a safe type are skipped.
import { createClient } from "@supabase/supabase-js";

import { getSafeContentType } from "../supabase/functions/_shared/attachments.ts";

const BUCKET = process.env.VITE_ATTACHMENTS_BUCKET || "attachments";
const PAGE_SIZE = 1000;

// The note attachments store the file type, which decides how the app displays
// them. Avatars and logos only store a URL.
const NOTE_TABLES = ["contact_notes", "deal_notes"];

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

  // file name -> its safe type
  const types = new Map(
    (await listObjects(supabase))
      .filter(
        (object) =>
          getSafeContentType(object.metadata?.mimetype) !==
          object.metadata?.mimetype,
      )
      .map((object) => [
        object.name,
        getSafeContentType(object.metadata?.mimetype),
      ]),
  );
  log(`${types.size} file(s) to retype in "${BUCKET}"`);
  for (const [name, type] of types) log(`  ${name} -> ${type}`);
  if (types.size === 0) return;

  if (!isDryRun) {
    for (const [name, type] of types) {
      await retypeObject(supabase, name, type);
    }
  }
  for (const table of NOTE_TABLES) {
    await retypeNoteAttachments(supabase, table, types, isDryRun);
  }
  log(isDryRun ? "Dry run: nothing was changed" : "Done");
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

const retypeObject = async (supabase, name, type) => {
  const { data, error } = await supabase.storage.from(BUCKET).download(name);
  if (error) throw new Error(`Failed to download ${name}: ${error.message}`);
  // supabase-js uploads a Blob with its own type and ignores the contentType
  // option, so the content is wrapped in a Blob of the safe type.
  const { error: updateError } = await supabase.storage
    .from(BUCKET)
    .update(name, new Blob([data], { type }));
  if (updateError) {
    throw new Error(`Failed to retype ${name}: ${updateError.message}`);
  }
};

const retypeNoteAttachments = async (supabase, table, types, isDryRun) => {
  let count = 0;
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select("id, attachments")
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Failed to read ${table}: ${error.message}`);

    for (const { id, attachments } of data) {
      if (!Array.isArray(attachments)) continue;
      const retyped = attachments.map((attachment) => {
        const type = types.get(getFileName(attachment));
        return type && attachment.type !== type
          ? { ...attachment, type }
          : attachment;
      });
      if (retyped.every((attachment, i) => attachment === attachments[i])) {
        continue;
      }
      count++;
      if (isDryRun) continue;
      const { error: updateError } = await supabase
        .from(table)
        .update({ attachments: retyped })
        .eq("id", id);
      if (updateError) {
        throw new Error(
          `Failed to update ${table} ${id}: ${updateError.message}`,
        );
      }
    }
    if (data.length < PAGE_SIZE) break;
  }
  log(`${table}: ${count} note(s) to update`);
};

// The name of the file in the bucket: its path, or the end of its URL.
const getFileName = (attachment) => {
  if (attachment?.path) return attachment.path;
  if (typeof attachment?.src !== "string") return null;
  const lastSegment = attachment.src.split(/[?#]/)[0].split("/").pop();
  try {
    return decodeURIComponent(lastSegment);
  } catch {
    return lastSegment;
  }
};

// eslint-disable-next-line no-console
const log = (...args) => console.log(...args);

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
