// Application questions live in a free-form `raw_answers` jsonb blob (no
// fixed schema — see 01_tables.sql) and evolve per Offer, so this can never
// be a fixed enum. Known keys get an explicit, human-phrased question;
// anything else is safely humanized rather than dropped or shown raw
// (Native Applications slice, §2: never show "why_this_program").
const KNOWN_ANSWER_LABELS: Record<string, string> = {
  why_this_program: "Why this program?",
  why_this_cohort: "Why this cohort?",
  availability: "Availability",
};

// snake_case or kebab-case -> "Title Case" — the generic fallback for any
// key not in the map above, so a future question never renders as a raw
// database key.
const humanizeKey = (key: string): string =>
  key
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export const labelForAnswerKey = (key: string): string =>
  KNOWN_ANSWER_LABELS[key] ?? humanizeKey(key);
