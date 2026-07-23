/**
 * Derive a stable slug value from a display label.
 * e.g. "Communication Services" → "communication-services"
 */
export const toSlug = (label: string): string =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
