// The importer stamps each historical waitlist membership's notes with how
// its joined_at was derived (see write.mjs's insertHistoricalWaitlistEntry).
// That evidence is the audit trail and stays stored — it just does not
// belong in the everyday waitlist row, where 37 copies of it drown out the
// people's names. Matched on the importer's own literal prefix, never on
// anything about the wording after it, so a note Leif actually typed is
// never mistaken for migration evidence.
export const IMPORT_PROVENANCE_PREFIX = "Historical import:";

export const isImportProvenance = (notes: string): boolean =>
  notes.trimStart().startsWith(IMPORT_PROVENANCE_PREFIX);
