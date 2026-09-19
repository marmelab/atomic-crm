import type { Contact } from "../types";

// What to call a person, in one place.
//
// This was written out by hand in 58 places, almost always as
//
//   `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim()
//
// which is right until somebody has only one name — 33 Contacts here do —
// and then it renders a stray space, or an empty string where a name
// should be, depending on which of the 58 copies you happened to hit.
//
// Nothing here invents a name. If the CRM does not know what somebody is
// called, that is the truthful answer and the caller decides what to show
// instead; it never falls back to an id, and never shortens or prettifies
// a stored name.
// Deliberately looser than Contact's own declaration. The columns are
// nullable in the database and 33 Contacts here carry only one name, so a
// display helper that refused null would push every caller back to the
// hand-rolled version this replaces.
export type NameParts = {
  first_name?: Contact["first_name"] | null;
  last_name?: Contact["last_name"] | null;
};

const clean = (value: string | null | undefined): string =>
  typeof value === "string" ? value.trim() : "";

// The person's name as the CRM knows it, or null if it does not.
export const contactDisplayName = (
  contact: NameParts | null | undefined,
): string | null => {
  if (!contact) return null;
  const name = [clean(contact.first_name), clean(contact.last_name)]
    .filter(Boolean)
    .join(" ");
  return name || null;
};

// The same, with an explicit fallback for places that must render
// something — a list row, a page heading. The fallback is the caller's
// choice precisely because there is no universally right one: a Deal name
// is sometimes better than an email, and an email is sometimes better than
// "Unknown".
export const contactDisplayNameOr = (
  contact: NameParts | null | undefined,
  fallback: string,
): string => contactDisplayName(contact) ?? fallback;

// Initials for an avatar. Empty when there is no name to take them from,
// so the caller can render the blank avatar rather than a stray letter.
export const contactInitials = (
  contact: NameParts | null | undefined,
): string => {
  if (!contact) return "";
  return [clean(contact.first_name), clean(contact.last_name)]
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
};
