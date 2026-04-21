export type DealLike = {
  id: number;
  sales_id: number | null;
  contact_ids: number[] | null;
};

export type CompanyLike = {
  name: string;
  sector: string | null;
};

export type ContactLike = {
  first_name: string | null;
  last_name: string | null;
};

export type SalesLike = {
  first_name: string | null;
  last_name: string | null;
};

export type NoshoProposalPayload = {
  clientName: string;
  clientType?: string;
  clientContact?: string;
  proposalRef: string;
  proposalDate: string;
  senderName?: string;
};

const FR_MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

export function formatFrenchDate(d: Date): string {
  return `${d.getDate()} ${FR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function buildProposalPayload(args: {
  deal: DealLike;
  company: CompanyLike;
  contact: ContactLike | null;
  sales: SalesLike | null;
  now: Date;
}): NoshoProposalPayload {
  const { deal, company, contact, sales, now } = args;

  const payload: NoshoProposalPayload = {
    clientName: company.name,
    proposalRef: `NSH-${now.getFullYear()}-${deal.id}`,
    proposalDate: formatFrenchDate(now),
  };

  if (company.sector) payload.clientType = company.sector;

  if (contact) {
    const name =
      `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim();
    if (name) payload.clientContact = name;
  }

  if (sales) {
    const name = `${sales.first_name ?? ""} ${sales.last_name ?? ""}`.trim();
    if (name) payload.senderName = name;
  }

  return payload;
}
