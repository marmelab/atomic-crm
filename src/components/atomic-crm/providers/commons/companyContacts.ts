import type { DataProvider, Identifier } from "ra-core";

import type { Company, Contact } from "../../types";

/**
 * A contact as edited in the company form. With an id it is an existing
 * contact, without one it is created on save. `mobile` and `email` stand for
 * the first entry of the contact's phone_jsonb / email_jsonb.
 */
export interface CompanyContactInput {
  id?: Identifier | null;
  first_name: string;
  last_name: string;
  title?: string | null;
  mobile?: string | null;
  whatsapp_number?: string | null;
  email?: string | null;
  is_primary?: boolean | null;
}

export type CompanyWithContacts = Partial<Company> & {
  contacts: CompanyContactInput[];
};

export const hasContactList = (data: unknown): data is CompanyWithContacts =>
  Array.isArray((data as CompanyWithContacts | undefined)?.contacts);

export const toCompanyContactInput = (
  contact: Contact,
): CompanyContactInput => ({
  id: contact.id,
  first_name: contact.first_name ?? "",
  last_name: contact.last_name ?? "",
  title: contact.title ?? "",
  mobile: contact.phone_jsonb?.[0]?.number ?? "",
  whatsapp_number: contact.whatsapp_number ?? "",
  email: contact.email_jsonb?.[0]?.email ?? "",
  is_primary: contact.is_primary ?? false,
});

/**
 * Rejects the lists the database refuses too, so both data providers fail
 * the same way: two primary contacts, or the same contact listed twice.
 */
export const assertValidContactList = (contacts: CompanyContactInput[]) => {
  if (contacts.filter((contact) => contact.is_primary).length > 1) {
    throw new Error("A company can only have one primary contact");
  }
  const ids = contacts.map((contact) => contact.id).filter((id) => id != null);
  if (new Set(ids).size !== ids.length) {
    throw new Error("The same contact is listed twice");
  }
};

const clean = (value: string | null | undefined) => value?.trim() || null;

/** Sets (or, when blank, drops) the first entry of a contact's list. */
const replaceFirst = <T>(list: T[] | null | undefined, entry: T | null) => {
  const [, ...rest] = list ?? [];
  const next = entry ? [entry, ...rest] : rest;
  return next.length > 0 ? next : null;
};

/**
 * Non-transactional equivalent of the save_company_with_contacts() Postgres
 * function, for the FakeRest demo provider: links / updates the listed
 * contacts, creates the new ones, and unlinks (never deletes) the others.
 */
export const syncCompanyContacts = async (
  dataProvider: DataProvider,
  companyId: Identifier,
  contacts: CompanyContactInput[],
) => {
  const { data: linkedContacts } = await dataProvider.getList<Contact>(
    "contacts",
    {
      filter: { company_id: companyId },
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "id", order: "ASC" },
    },
  );
  const existingIds = contacts.flatMap((contact) =>
    contact.id != null ? [contact.id] : [],
  );
  const { data: existingContacts } =
    existingIds.length > 0
      ? await dataProvider.getMany<Contact>("contacts", { ids: existingIds })
      : { data: [] };

  const removedContacts = linkedContacts.filter(
    (contact) => !existingIds.includes(contact.id),
  );
  for (const contact of removedContacts) {
    await dataProvider.update<Contact>("contacts", {
      id: contact.id,
      data: { company_id: null, is_primary: false },
      previousData: contact,
    });
  }

  const now = new Date().toISOString();
  for (const contact of contacts) {
    const email = clean(contact.email)?.toLowerCase();
    const mobile = clean(contact.mobile);
    const fields = {
      first_name: clean(contact.first_name) ?? "",
      last_name: clean(contact.last_name) ?? "",
      title: clean(contact.title) ?? "",
      company_id: companyId,
      whatsapp_number: clean(contact.whatsapp_number),
      is_primary: !!contact.is_primary,
    };
    const previous = existingContacts.find((c) => c.id === contact.id);

    if (contact.id == null) {
      await dataProvider.create<Contact>("contacts", {
        data: {
          ...fields,
          email_jsonb: email ? [{ email, type: "Work" }] : [],
          phone_jsonb: mobile ? [{ number: mobile, type: "Work" }] : [],
          first_seen: now,
          last_seen: now,
          tags: [],
        },
      });
    } else if (previous) {
      const emailJsonb = replaceFirst(
        previous.email_jsonb,
        email
          ? { email, type: previous.email_jsonb?.[0]?.type ?? "Work" }
          : null,
      );
      const phoneJsonb = replaceFirst(
        previous.phone_jsonb,
        mobile
          ? { number: mobile, type: previous.phone_jsonb?.[0]?.type ?? "Work" }
          : null,
      );
      await dataProvider.update<Contact>("contacts", {
        id: contact.id,
        data: {
          ...fields,
          email_jsonb: emailJsonb ?? [],
          phone_jsonb: phoneJsonb ?? [],
        },
        previousData: previous,
      });
    } else {
      throw new Error(`Contact ${contact.id} not found`);
    }
  }
};
