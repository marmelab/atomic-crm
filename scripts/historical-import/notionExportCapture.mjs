// Reading a Notion database export as evidence.
//
// The 159 historical Applications were imported with raw_answers = {}: the
// original pull only ever asked Notion for url, email, name, status and
// submitted_at. The answers still exist in Notion, so the recovery route is
// a database export — not a model reading pages and retyping them, because
// a hash over a transcription certifies the transcription, not the source.
//
// Three things the export does not give us, and how each is handled here:
//
//   1. No page id. Notion's database CSV carries properties only, and none
//      of the three databases has a page-id property. Rows are bound to
//      page ids through the submission instant, which Notion reports in
//      UTC and the CSV renders in local time.
//
//   2. No stated timezone. Rather than assume one, detectOffset finds every
//      offset under which EVERY row matches a known Notion instant. A
//      single surviving candidate is a proof; anything else is a refusal.
//
//   3. No row identity inside a whole-table copy. The January database was
//      built by copying the original GYU database on 2026-08-27, stamping
//      56 rows with the same creation instant. Those rows cannot be told
//      apart by any evidence we hold, so they are left unbound and marked
//      as artifacts rather than guessed at — and they must never become
//      CRM Applications.

import { createHash } from "node:crypto";

/**
 * The two instants stamped on every row of the 2026-08-27 whole-table copy
 * that created "Growing Yourself Up App — Jan 2027".
 */
export const COPY_ARTIFACT_INSTANTS = Object.freeze([
  "2026-08-27T16:24:15Z",
  "2026-08-27T16:24:16Z",
]);

export const isCopyArtifactInstant = (iso) =>
  COPY_ARTIFACT_INSTANTS.includes(iso);

/** RFC4180-ish: quoted fields, embedded newlines, doubled quotes, BOM. */
export const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  for (; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\r") {
      /* the \n ends the record */
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
};

const MONTHS = {
  January: 0,
  February: 1,
  March: 2,
  April: 3,
  May: 4,
  June: 5,
  July: 6,
  August: 7,
  September: 8,
  October: 9,
  November: 10,
  December: 11,
};

/**
 * "September 16, 2026 10:28 PM" at a candidate UTC offset, as epoch ms.
 * Returns null for anything that is not that shape — never a partial guess.
 */
export const parseExportTime = (text, offsetHours) => {
  const m = /^([A-Za-z]+)\s+(\d+),\s*(\d{4})\s+(\d+):(\d+)\s*([AP]M)$/.exec(
    (text ?? "").trim(),
  );
  if (!m) return null;
  const [, mon, day, year, hh, mm, ap] = m;
  if (!(mon in MONTHS)) return null;
  let hour = Number(hh) % 12;
  if (ap === "PM") hour += 12;
  return Date.UTC(
    Number(year),
    MONTHS[mon],
    Number(day),
    hour - offsetHours,
    Number(mm),
  );
};

/** Epoch ms of an ISO instant, truncated to the minute the CSV renders. */
export const toMinute = (iso) => {
  const t = Date.parse(iso.replace(" ", "T"));
  return Number.isNaN(t) ? null : t - (t % 60000);
};

/**
 * Every offset under which all exported times land on a known Notion
 * instant. One candidate proves the timezone; zero or several refuse it.
 */
export const detectOffset = (times, notionMinutes) => {
  const found = [];
  for (let off = -12; off <= 14; off += 1) {
    if (times.every((t) => notionMinutes.has(parseExportTime(t, off)))) {
      found.push(off);
    }
  }
  return found;
};

/** Column names and values in export order. The hash is taken over this. */
export const canonicalize = (columns, values) =>
  JSON.stringify({ columns, values });

export const hashOf = (text) =>
  createHash("sha256").update(text, "utf8").digest("hex");

/**
 * Bind exported rows to Notion page ids.
 *
 * `notionRows` is [{ pageId, instant, status }] straight from Notion. A row
 * binds only when its instant identifies exactly one page that nothing else
 * has claimed; otherwise it is returned unbound, never guessed.
 */
export const bindRows = ({ times, notionRows, offset }) => {
  const byMinute = new Map();
  for (const r of notionRows) {
    const key = toMinute(r.instant);
    if (!byMinute.has(key)) byMinute.set(key, []);
    byMinute.get(key).push(r);
  }

  const claimed = new Set();
  return times.map((text) => {
    const minute = parseExportTime(text, offset);
    const candidates = byMinute.get(minute) ?? [];
    const artifact = candidates.some((c) => isCopyArtifactInstant(c.instant));
    const free = candidates.filter((c) => !claimed.has(c.pageId));
    if (free.length !== 1) {
      return {
        pageId: null,
        binding: "unbound_ambiguous_instant",
        isCopyArtifact: artifact,
        submittedAt: minute === null ? null : new Date(minute).toISOString(),
      };
    }
    claimed.add(free[0].pageId);
    return {
      pageId: free[0].pageId,
      binding: artifact
        ? "submission_time_unique_copy_artifact"
        : "submission_time_unique",
      isCopyArtifact: artifact,
      submittedAt: new Date(minute).toISOString(),
    };
  });
};

/**
 * Split bound source rows against the Applications already in the CRM.
 * Copy artifacts are removed FIRST: they are evidence of a database copy,
 * not of anybody applying, so they never count toward what is missing.
 */
export const partitionSourceRows = (rows, knownPageIds) => {
  const artifacts = rows.filter((r) => r.isCopyArtifact);
  const real = rows.filter((r) => !r.isCopyArtifact);
  return {
    copyArtifacts: artifacts,
    alreadyInCrm: real.filter((r) => r.pageId && knownPageIds.has(r.pageId)),
    genuinelyAdditional: real.filter(
      (r) => r.pageId && !knownPageIds.has(r.pageId),
    ),
    unbound: real.filter((r) => !r.pageId),
  };
};

/**
 * Where one additional source row belongs, using only what is certain.
 *
 * `evidence` is { contactsByEmail, contactsByName, hasEmail,
 * opportunitiesForOffer, existingApplicationForPage, activeOpportunity }.
 */
export const classifyAdditional = (evidence) => {
  const {
    hasEmail = false,
    contactsByEmail = 0,
    contactsByName = 0,
    opportunitiesForOffer = 0,
    existingApplicationForPage = false,
    activeOpportunity = false,
  } = evidence;

  if (existingApplicationForPage) return "D";

  const matches = Math.max(contactsByEmail, contactsByName);
  if (matches > 1) return "E";
  if (matches === 0) {
    // A person with no email address cannot be identified the way every
    // other identity in this system is, so creating one is a decision.
    return hasEmail ? "C" : "E";
  }

  if (opportunitiesForOffer > 1) return "F";
  if (opportunitiesForOffer === 0) return "B";
  // Exactly one Opportunity — but attaching a new submission to an
  // Opportunity that already ended would silently reactivate it.
  return activeOpportunity ? "A" : "G";
};
