import type { SearchResult } from "../types";

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
      return `/contacts/${result.record_id}/show`;
    case "deals":
      return isMobile ? null : `/deals/${result.record_id}/show`;
    case "tasks":
      // Tasks have no page of their own: link to the contact they belong to.
      return result.contact_id ? `/contacts/${result.contact_id}/show` : null;
    case "contact_notes":
      if (!result.contact_id) {
        return null;
      }
      return isMobile
        ? `/contacts/${result.contact_id}/notes/${result.record_id}`
        : `/contacts/${result.contact_id}/show`;
    case "deal_notes":
      return isMobile || !result.deal_id
        ? null
        : `/deals/${result.deal_id}/show`;
    default:
      return null;
  }
};
