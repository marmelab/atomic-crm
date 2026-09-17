import type { SortOption } from "@/components/admin/sort-button";

// Every ordering the Contacts list offers, named in business language.
//
// Spelled out rather than using SortButton's `fields` API, which shows one
// entry per field and flips direction on re-click: a field you are not
// already sorting by always starts ASC, so "Date added — newest first"
// would take two clicks and "oldest first" would be unreachable in one.
// For date columns the direction IS the thing being chosen.
//
// first_seen is when the Contact first entered the CRM's knowledge and
// last_seen their most recent known activity — both real columns on
// contacts_summary, so every option below actually sorts.
export const CONTACT_SORT_OPTIONS: SortOption[] = [
  { field: "first_seen", order: "DESC", label: "Date added — newest first" },
  { field: "first_seen", order: "ASC", label: "Date added — oldest first" },
  { field: "last_seen", order: "DESC", label: "Last activity — newest first" },
  { field: "last_seen", order: "ASC", label: "Last activity — oldest first" },
  { field: "first_name", order: "ASC", label: "First name — A→Z" },
  { field: "first_name", order: "DESC", label: "First name — Z→A" },
  { field: "last_name", order: "ASC", label: "Last name — A→Z" },
  { field: "last_name", order: "DESC", label: "Last name — Z→A" },
];

// Newest-first: for daily operation the people who just arrived are the
// ones Leif is most likely to be looking for. Supersedes the previous
// alphabetical default, which was chosen when first_seen/last_seen carried
// no data for most Contacts — see the backfill in
// 20260917230000_contact_first_last_seen_backfill.sql.
export const CONTACT_DEFAULT_SORT = {
  field: "first_seen",
  order: "DESC" as const,
};
