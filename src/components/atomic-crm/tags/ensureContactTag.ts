import type { DataProvider, Identifier } from "ra-core";

import type { Contact, Tag } from "../types";

// Attaches a system-managed tag to a Contact exactly once, creating the tag
// itself only if the workspace does not already have one. Matched
// case-insensitively so a manually-created "No-Show" is reused rather than
// duplicated alongside "No-show".
//
// Extracted from recordSalesCallNoShow.ts when Ghosted became the second
// caller. Only these two tags are system-applied, deliberately: a tag is
// behavioural shorthand that survives across Opportunities ("this person
// has gone quiet on me before"), and every other candidate — Cancelled,
// Committed, Declined, Applicant, Waitlist, Current Client, Past Client,
// Scholarship — is a structured fact owned by an Opportunity, Enrollment,
// Application, or waitlist entry. Mirroring those as tags would create a
// second, staler copy of something the database already answers exactly.
// Manual tags are unaffected.
export const ensureContactTag = async (
  dataProvider: DataProvider,
  contactId: Identifier,
  tagName: string,
  tagColor: string,
): Promise<void> => {
  const { data: tags } = await dataProvider.getList<Tag>("tags", {
    filter: {},
    pagination: { page: 1, perPage: 500 },
    sort: { field: "id", order: "ASC" },
  });

  let tag =
    tags.find((t) => t.name?.toLowerCase() === tagName.toLowerCase()) ?? null;
  if (!tag) {
    const { data: created } = await dataProvider.create<Tag>("tags", {
      data: { name: tagName, color: tagColor } as Partial<Tag>,
    });
    tag = created;
  }

  const { data: contact } = await dataProvider.getOne<Contact>("contacts", {
    id: contactId,
  });
  const current = contact.tags ?? [];
  if (current.some((id) => String(id) === String(tag.id))) return;

  await dataProvider.update<Contact>("contacts", {
    id: contact.id,
    data: { tags: [...current, tag.id] },
    previousData: contact,
  });
};
