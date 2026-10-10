/**
 * Client-side mirror of the matching done by `global_search` in Postgres:
 * text is unaccented and lowercased, split on anything that is not a letter or
 * a digit, and a query term matches a word it is a prefix of.
 */

export type TextPart = { text: string; isMatch: boolean };

type Range = { start: number; end: number; term: string };

const WORD = /[\p{L}\p{N}]+/gu;
const SNIPPET_RADIUS = 60;
// Long titles (a note's first 200 characters) are truncated on screen, so a
// term past this point does not count as shown by the title.
const VISIBLE_TITLE_LENGTH = 30;

const normalize = (value: string): string =>
  value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export const getSearchTerms = (query: string): string[] => [
  ...new Set(normalize(query).match(WORD) ?? []),
];

/** Length of `word` covered by `term` when it is a prefix of it, else 0. */
const prefixLength = (word: string, term: string): number => {
  let normalized = "";
  let length = 0;
  for (const char of word) {
    normalized += normalize(char);
    length += char.length;
    if (normalized.length >= term.length) {
      return normalized.startsWith(term) ? length : 0;
    }
    if (!term.startsWith(normalized)) {
      return 0;
    }
  }
  return 0;
};

const findMatches = (text: string, terms: string[]): Range[] =>
  [...text.matchAll(WORD)].flatMap((word) => {
    const start = word.index ?? 0;
    const best = terms
      .map((term) => ({ term, length: prefixLength(word[0], term) }))
      .reduce((a, b) => (b.length > a.length ? b : a), {
        term: "",
        length: 0,
      });
    return best.length > 0
      ? [{ start, end: start + best.length, term: best.term }]
      : [];
  });

/** Split `text` into parts, flagging the ones matched by a search term. */
export const highlight = (text: string, terms: string[]): TextPart[] => {
  const parts: TextPart[] = [];
  let cursor = 0;
  for (const { start, end } of findMatches(text, terms)) {
    if (start > cursor) {
      parts.push({ text: text.slice(cursor, start), isMatch: false });
    }
    parts.push({ text: text.slice(start, end), isMatch: true });
    cursor = end;
  }
  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), isMatch: false });
  }
  return parts;
};

/**
 * An excerpt of `content` around the first term that the visible start of
 * `title` does not already show, or null when it shows every term (or content
 * has none of them).
 */
export const getSnippet = (
  title: string,
  content: string,
  terms: string[],
  radius = SNIPPET_RADIUS,
): string | null => {
  const shown = new Set(
    findMatches(title.slice(0, VISIBLE_TITLE_LENGTH), terms).map(
      ({ term }) => term,
    ),
  );
  const missing = terms.filter((term) => !shown.has(term));
  if (missing.length === 0) {
    return null;
  }
  const match = findMatches(content, missing)[0];
  if (!match) {
    return null;
  }
  const from = Math.max(0, match.start - radius);
  const to = Math.min(content.length, match.end + radius);
  // cut on spaces so the excerpt never starts or ends mid-word
  const start =
    from === 0
      ? 0
      : Math.min(content.indexOf(" ", from) + 1 || from, match.start);
  const lastSpace = content.lastIndexOf(" ", to);
  const end = to === content.length || lastSpace <= match.end ? to : lastSpace;
  const excerpt = content.slice(start, end).replace(/\s+/g, " ").trim();
  return `${start > 0 ? "…" : ""}${excerpt}${end < content.length ? "…" : ""}`;
};
