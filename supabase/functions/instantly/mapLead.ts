// Maps a CRM contact to an Instantly lead payload. Pure + unit-tested.

export interface CrmEmail {
  email: string;
  type?: string;
}

export interface CrmContactInput {
  first_name?: string;
  last_name?: string;
  company_name?: string;
  email_jsonb?: CrmEmail[];
}

export interface InstantlyLead {
  email: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
}

// Pick the best address for outreach: the first "Work" email, else the first
// email present.
export const pickPrimaryEmail = (emails: CrmEmail[] = []): string | null => {
  const valid = (emails ?? []).filter((entry) => entry?.email);
  const work = valid.find((entry) => entry.type === "Work");
  return (work ?? valid[0])?.email ?? null;
};

export const mapLead = (contact: CrmContactInput): InstantlyLead | null => {
  const email = pickPrimaryEmail(contact.email_jsonb);
  if (!email) return null;
  return {
    email,
    first_name: contact.first_name || undefined,
    last_name: contact.last_name || undefined,
    company_name: contact.company_name || undefined,
  };
};
