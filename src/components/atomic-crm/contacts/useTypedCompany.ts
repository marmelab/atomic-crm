import { useDataProvider, useGetIdentity } from "ra-core";

import type { Company, Contact } from "../types";

/** Form field holding the company name typed in the contact form. */
export const COMPANY_DRAFT_SOURCE = "company_name_draft";

type ContactFormData = Contact & { [COMPANY_DRAFT_SOURCE]?: string };

/**
 * Returns a save transform for the contact forms: when the user typed a
 * company name but did not pick an option, links the contact to the company
 * of that name, creating it if none exists. Always strips the draft field.
 */
export const useTypedCompany = () => {
  const dataProvider = useDataProvider();
  const { identity } = useGetIdentity();

  return async (data: ContactFormData): Promise<Contact> => {
    const { [COMPANY_DRAFT_SOURCE]: draft, ...contact } = data;
    const name = draft?.trim();
    if (contact.company_id || !name) return contact;

    const { data: matches } = await dataProvider.getList<Company>("companies", {
      filter: { q: name },
      pagination: { page: 1, perPage: 50 },
      sort: { field: "id", order: "ASC" },
    });
    const existing = matches.find(
      (company) => company.name?.trim().toLowerCase() === name.toLowerCase(),
    );
    const company =
      existing ??
      (
        await dataProvider.create<Company>("companies", {
          data: {
            name,
            sales_id: identity?.id,
            created_at: new Date().toISOString(),
          },
        })
      ).data;
    return { ...contact, company_id: company.id };
  };
};
