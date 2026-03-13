import type { DataProvider, Identifier } from "ra-core";

import {
  COMPANY_CREATED,
  CONTACT_CREATED,
  CONTACT_NOTE_CREATED,
  DEAL_CREATED,
  DEAL_NOTE_CREATED,
} from "../../consts";
import type {
  Activity,
  Company,
  Contact,
  ContactNote,
  Deal,
  DealNote,
} from "../../types";

/**
 * Default implementation: fetches activity via 5 separate list queries.
 * Used by the FakeRest data provider and as fallback when the activity_log
 * view is not yet available.
 */
export async function getActivityLog(
  dataProvider: DataProvider,
  companyId?: Identifier,
  salesId?: Identifier,
): Promise<Activity[]> {
  const companyFilter = {} as any;
  if (companyId) {
    companyFilter.id = companyId;
  } else if (salesId) {
    companyFilter["sales_id@in"] = `(${salesId})`;
  }

  const filter = {} as any;
  if (companyId) {
    filter.company_id = companyId;
  } else if (salesId) {
    filter["sales_id@in"] = `(${salesId})`;
  }

  const [newCompanies, newContactsAndNotes, newDealsAndNotes] =
    await Promise.all([
      getNewCompanies(dataProvider, companyFilter),
      getNewContactsAndNotes(dataProvider, filter),
      getNewDealsAndNotes(dataProvider, filter),
    ]);

  return [...newCompanies, ...newContactsAndNotes, ...newDealsAndNotes]
    .sort(
      (a, b) =>
        (a.date || new Date(0).toISOString()).localeCompare(
          b.date || new Date(0).toISOString(),
        ) * -1,
    )
    .slice(0, 250);
}

/**
 * Optimised implementation using the activity_log SQL view.
 * Used by the Supabase data provider.
 */
export async function getActivityLogFromView(
  dataProvider: DataProvider,
  companyId?: Identifier,
  salesId?: Identifier,
): Promise<Activity[]> {
  const filter = {} as any;
  if (companyId) {
    filter.company_id = companyId;
  } else if (salesId) {
    filter["sales_id@in"] = `(${salesId})`;
  }

  const { data } = await dataProvider.getList<Activity>("activity_log", {
    filter,
    pagination: { page: 1, perPage: 250 },
    sort: { field: "date", order: "DESC" },
  });

  return data;
}

const getNewCompanies = async (
  dataProvider: DataProvider,
  filter: any,
): Promise<Activity[]> => {
  const { data: companies } = await dataProvider.getList<Company>("companies", {
    filter,
    pagination: { page: 1, perPage: 250 },
    sort: { field: "created_at", order: "DESC" },
  });
  return companies.map((company) => ({
    id: `company.${company.id}.created`,
    type: COMPANY_CREATED,
    company_id: company.id,
    company,
    sales_id: company.sales_id,
    date: company.created_at,
  }));
};

async function getNewContactsAndNotes(
  dataProvider: DataProvider,
  filter: any,
): Promise<Activity[]> {
  const { data: contacts } = await dataProvider.getList<Contact>("contacts", {
    filter,
    pagination: { page: 1, perPage: 250 },
    sort: { field: "first_seen", order: "DESC" },
  });

  const recentContactNotesFilter = {} as any;
  if (filter.sales_id) {
    recentContactNotesFilter.sales_id = filter.sales_id;
  }
  if (filter.company_id) {
    const contactIds = contacts.map((contact) => contact.id).join(",");
    recentContactNotesFilter["contact_id@in"] = `(${contactIds})`;
  }

  const { data: contactNotes } = await dataProvider.getList<ContactNote>(
    "contact_notes",
    {
      filter: recentContactNotesFilter,
      pagination: { page: 1, perPage: 250 },
      sort: { field: "date", order: "DESC" },
    },
  );

  const newContacts = contacts.map((contact) => ({
    id: `contact.${contact.id}.created`,
    type: CONTACT_CREATED,
    company_id: contact.company_id,
    sales_id: contact.sales_id,
    contact,
    date: contact.first_seen,
  }));

  const newContactNotes = contactNotes.map((contactNote) => ({
    id: `contactNote.${contactNote.id}.created`,
    type: CONTACT_NOTE_CREATED,
    sales_id: contactNote.sales_id,
    contactNote,
    date: contactNote.date,
  }));

  return [...newContacts, ...newContactNotes];
}

async function getNewDealsAndNotes(
  dataProvider: DataProvider,
  filter: any,
): Promise<Activity[]> {
  const { data: deals } = await dataProvider.getList<Deal>("deals", {
    filter,
    pagination: { page: 1, perPage: 250 },
    sort: { field: "created_at", order: "DESC" },
  });

  const recentDealNotesFilter = {} as any;
  if (filter.sales_id) {
    recentDealNotesFilter.sales_id = filter.sales_id;
  }
  if (filter.company_id) {
    const dealIds = deals.map((deal) => deal.id).join(",");
    recentDealNotesFilter["deal_id@in"] = `(${dealIds})`;
  }

  const { data: dealNotes } = await dataProvider.getList<DealNote>(
    "deal_notes",
    {
      filter: recentDealNotesFilter,
      pagination: { page: 1, perPage: 250 },
      sort: { field: "date", order: "DESC" },
    },
  );

  const newDeals = deals.map((deal) => ({
    id: `deal.${deal.id}.created`,
    type: DEAL_CREATED,
    company_id: deal.company_id,
    sales_id: deal.sales_id,
    deal,
    date: deal.created_at,
  }));

  const newDealNotes = dealNotes.map((dealNote) => ({
    id: `dealNote.${dealNote.id}.created`,
    type: DEAL_NOTE_CREATED,
    sales_id: dealNote.sales_id,
    dealNote,
    date: dealNote.date,
  }));

  return [...newDeals, ...newDealNotes];
}
