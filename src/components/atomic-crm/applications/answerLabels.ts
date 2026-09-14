// Application questions live in a free-form `raw_answers` jsonb blob (no
// fixed schema — see 01_tables.sql) and evolve per Offer, so this can never
// be a fixed enum. Known keys get an explicit, human-phrased question;
// anything else is safely humanized rather than dropped or shown raw
// (Native Applications slice, §2: never show "why_this_program").
//
// Real LE + GYU Application Forms slice: le_/gyu_-prefixed keys map to
// Leif's own real questionnaire wording (public-application/
// LivingExampleApplicationPage.tsx / GrowingYourselfUpApplicationPage.tsx
// — kept in sync with those by hand, the same dual-source convention
// already used elsewhere in this app). Reviewers must see the actual
// question, never a cryptic key (Phase 6). Text below reflects
// human-acceptance round 1's corrections; keys are unchanged from the
// first pass — wording changes alone don't warrant answer-key churn. This
// map is always a plain string even where the public form itself renders
// part of a question in italics (gyu_why_now) — that's a visual
// treatment, not a content difference a reviewer needs to see.
const KNOWN_ANSWER_LABELS: Record<string, string> = {
  // Legacy placeholder keys — kept so any already-submitted Application
  // predating this slice still renders a real question, not a raw key.
  why_this_program: "Why this program?",
  why_this_cohort: "Why this cohort?",
  availability: "Availability",

  // The Living Example Application
  le_main_pattern:
    "What's the main pattern, emotion, or relationship dynamic you're struggling with right now?",
  le_prior_attempts: "What have you already tried to change or shift this?",
  le_hoped_change: "How are you hoping to change through working together?",
  le_hoped_support: "How are you hoping I will support you?",
  le_commitment_scale:
    "On a scale of 1–10, how committed are you to changing this pattern/way-of-being?",

  // Growing Yourself Up Application
  gyu_biggest_challenge:
    "What's the biggest challenge you're facing in your personal growth and healing?",
  gyu_why_now: "Why are you ready for support and change now?",
  gyu_hoped_outcome:
    "What are you hoping this program with Leif helps you create in your life and relationships?",
  gyu_commitment_scale:
    "On a scale from 1–10, how ready are you to make a time, financial, and personal commitment to the change you want?",
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
