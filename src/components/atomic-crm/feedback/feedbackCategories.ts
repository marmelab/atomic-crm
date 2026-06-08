import type { FeedbackCategory } from "../types";

export type FeedbackCategoryDef = {
  value: FeedbackCategory;
  label: string;
  emoji: string;
  /** Tailwind-klasser för bubblans kategori-badge */
  badgeClassName: string;
};

// Delas av input-baren (val av kategori) och bubblan (visning).
export const FEEDBACK_CATEGORIES: readonly FeedbackCategoryDef[] = [
  {
    value: "works",
    label: "Funkar bra",
    emoji: "👍",
    badgeClassName:
      "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  },
  {
    value: "bug",
    label: "Funkar inte / bugg",
    emoji: "🐛",
    badgeClassName:
      "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  },
  {
    value: "request",
    label: "Förslag / saknas",
    emoji: "💡",
    badgeClassName:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  },
] as const;

export const getFeedbackCategory = (
  value?: string,
): FeedbackCategoryDef | undefined =>
  FEEDBACK_CATEGORIES.find((category) => category.value === value);
