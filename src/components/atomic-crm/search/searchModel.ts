import { Building2, DollarSign, FileText, ListTodo, User } from "lucide-react";
import type { ComponentType } from "react";

import type { SearchResourceName, SearchResult } from "../types";

/**
 * Global search helpers, shared by the search dialog and the FakeRest
 * emulation. Matching mirrors `global_search` in Postgres: text is unaccented
 * and lowercased, split on anything that is not a letter or a digit, and a
 * query term matches a word it is a prefix of.
 */

export type TextPart = { text: string; isMatch: boolean };

type Range = { start: number; end: number; term: string };

const WORD = /[\p{L}\p{N}]+/gu;
const SNIPPET_RADIUS = 60;
// Long titles (a note's first 200 characters) are truncated on screen, so a
// term past this point does not count as shown by the title.
const VISIBLE_TITLE_LENGTH = 30;

// Letters Postgres unaccent() folds but Unicode does not decompose
const FOLDED_LETTERS: Record<string, string> = {
  æ: "ae",
  ð: "d",
  ø: "o",
  þ: "th",
  ß: "ss",
  đ: "d",
  ħ: "h",
  ı: "i",
  ĳ: "ij",
  ĸ: "q",
  ŀ: "l",
  ł: "l",
  ŋ: "n",
  œ: "oe",
  ŧ: "t",
  ſ: "s",
};
const FOLDABLE_LETTER = new RegExp(
  `[${Object.keys(FOLDED_LETTERS).join("")}]`,
  "g",
);

const normalize = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(FOLDABLE_LETTER, (letter) => FOLDED_LETTERS[letter]);

export const getSearchTerms = (query: string): string[] => [
  ...new Set(normalize(query).match(WORD) ?? []),
];

/**
 * Whether every term starts a word of `text`: the `@@` test `global_search`
 * runs in Postgres, for the FakeRest emulation.
 */
export const matchesAllTerms = (text: string, terms: string[]): boolean => {
  const words = normalize(text).match(WORD) ?? [];
  return terms.every((term) => words.some((word) => word.startsWith(term)));
};

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
  // trim whitespace, and the " · " between fields when the cut lands on one
  const excerpt = content
    .slice(start, end)
    .replace(/\s+/g, " ")
    .replace(/^[\s·]+|[\s·]+$/g, "");
  return `${start > 0 ? "…" : ""}${excerpt}${end < content.length ? "…" : ""}`;
};

export type SearchResourceDescriptor = {
  name: SearchResourceName;
  icon: ComponentType<{ className?: string }>;
  labelKey: string;
};

/** Result groups, in the order they appear in the search dialog. */
export const SEARCH_RESOURCES: SearchResourceDescriptor[] = [
  { name: "contacts", icon: User, labelKey: "crm.search.groups.contacts" },
  {
    name: "companies",
    icon: Building2,
    labelKey: "crm.search.groups.companies",
  },
  { name: "deals", icon: DollarSign, labelKey: "crm.search.groups.deals" },
  { name: "tasks", icon: ListTodo, labelKey: "crm.search.groups.tasks" },
  {
    name: "contact_notes",
    icon: FileText,
    labelKey: "crm.search.groups.contact_notes",
  },
  {
    name: "deal_notes",
    icon: FileText,
    labelKey: "crm.search.groups.deal_notes",
  },
];

export const DESKTOP_SEARCH_RESOURCES: SearchResourceName[] =
  SEARCH_RESOURCES.map(({ name }) => name);

export const MOBILE_SEARCH_RESOURCES: SearchResourceName[] =
  DESKTOP_SEARCH_RESOURCES.filter(
    (name) => name !== "deals" && name !== "deal_notes",
  );

type LinkableResult = Pick<
  SearchResult,
  "resource" | "record_id" | "contact_id" | "deal_id"
>;

/**
 * Resolve the in-app URL for a global search result.
 *
 * Returns null when the result has no reachable page on the current layout:
 * the mobile app registers no deal resource, and a note or task whose parent
 * record is missing cannot be linked.
 */
export const getSearchResultUrl = (
  result: LinkableResult,
  isMobile: boolean,
): string | null => {
  switch (result.resource) {
    case "companies":
      return `/companies/${result.record_id}/show`;
    case "contacts":
      // On mobile, open the details tab: looking up a contact is usually
      // about reaching their email or phone, not their notes.
      return isMobile
        ? `/contacts/${result.record_id}/show?tab=details`
        : `/contacts/${result.record_id}/show`;
    case "deals":
      return isMobile ? null : `/deals/${result.record_id}/show`;
    case "tasks":
      // Tasks have no page of their own: link to the contact they belong to,
      // on mobile straight to its tasks tab.
      if (result.contact_id == null) {
        return null;
      }
      return isMobile
        ? `/contacts/${result.contact_id}/show?tab=tasks`
        : `/contacts/${result.contact_id}/show`;
    case "contact_notes":
      if (result.contact_id == null) {
        return null;
      }
      return isMobile
        ? `/contacts/${result.contact_id}/notes/${result.record_id}`
        : `/contacts/${result.contact_id}/show`;
    case "deal_notes":
      return isMobile || result.deal_id == null
        ? null
        : `/deals/${result.deal_id}/show`;
    default:
      return null;
  }
};
