import type { DataProvider, Identifier } from "ra-core";

import type {
  Company,
  Contact,
  ContactNote,
  Deal,
  DealNote,
  SearchResult,
  Task,
} from "../../types";

const PER_RESOURCE_LIMIT = 50;
const MAX_RESULTS = 250;

const searchResource = async <T>(
  dataProvider: DataProvider,
  resource: string,
  q: string,
  sortField: string,
): Promise<T[]> => {
  const { data } = await dataProvider.getList<any>(resource, {
    filter: { q },
    pagination: { page: 1, perPage: PER_RESOURCE_LIMIT },
    sort: { field: sortField, order: "DESC" },
  });
  return data as T[];
};

const getLabels = async <T extends { id: Identifier }>(
  dataProvider: DataProvider,
  resource: string,
  ids: (Identifier | undefined | null)[],
  getLabel: (record: T) => string,
): Promise<Map<Identifier, string>> => {
  const uniqueIds = [...new Set(ids.filter(Boolean) as Identifier[])];
  if (uniqueIds.length === 0) {
    return new Map();
  }
  const { data } = await dataProvider.getMany<any>(resource, {
    ids: uniqueIds,
  });
  return new Map((data as T[]).map((record) => [record.id, getLabel(record)]));
};

const contactName = (contact: Pick<Contact, "first_name" | "last_name">) =>
  [contact.first_name, contact.last_name].filter(Boolean).join(" ");

const byDateDesc = (a: SearchResult, b: SearchResult) =>
  (b.date ?? "").localeCompare(a.date ?? "");

/**
 * Emulates the `search_index` database view for the FakeRest provider, by
 * running FakeRest's own `q` search on each searchable resource and mapping
 * the matches to the view's shape.
 *
 * FIXME: requires one query per resource, and FakeRest matches the whole term
 * as a single substring where Postgres ANDs one `ilike` per word. The Supabase
 * provider queries the real view instead.
 */
export async function getSearchResults(
  dataProvider: DataProvider,
  query: string,
): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) {
    return [];
  }

  const [companies, contacts, deals, tasks, contactNotes, dealNotes] =
    await Promise.all([
      searchResource<Company>(dataProvider, "companies", q, "created_at"),
      searchResource<Contact>(dataProvider, "contacts", q, "last_seen"),
      searchResource<Deal>(dataProvider, "deals", q, "created_at"),
      searchResource<Task>(dataProvider, "tasks", q, "due_date"),
      searchResource<ContactNote>(dataProvider, "contact_notes", q, "date"),
      searchResource<DealNote>(dataProvider, "deal_notes", q, "date"),
    ]);

  const [contactLabels, dealLabels] = await Promise.all([
    getLabels<Contact>(
      dataProvider,
      "contacts",
      [
        ...tasks.map((task) => task.contact_id),
        ...contactNotes.map((note) => note.contact_id),
      ],
      contactName,
    ),
    getLabels<Deal>(
      dataProvider,
      "deals",
      dealNotes.map((note) => note.deal_id),
      (deal) => deal.name,
    ),
  ]);

  const rows: SearchResult[] = [
    ...companies.map((company) => ({
      id: `company.${company.id}`,
      resource: "companies" as const,
      record_id: company.id,
      title: company.name,
      subtitle: company.sector ?? null,
      content: null,
      company_id: company.id,
      contact_id: null,
      deal_id: null,
      date: company.created_at ?? null,
    })),
    ...contacts.map((contact) => ({
      id: `contact.${contact.id}`,
      resource: "contacts" as const,
      record_id: contact.id,
      title: contactName(contact),
      subtitle: contact.company_name ?? null,
      content: null,
      company_id: contact.company_id ?? null,
      contact_id: contact.id,
      deal_id: null,
      date: contact.first_seen ?? null,
    })),
    ...deals
      .filter((deal) => !deal.archived_at)
      .map((deal) => ({
        id: `deal.${deal.id}`,
        resource: "deals" as const,
        record_id: deal.id,
        title: deal.name,
        subtitle: null,
        content: null,
        company_id: deal.company_id ?? null,
        contact_id: null,
        deal_id: deal.id,
        date: deal.created_at ?? null,
      })),
    ...tasks.map((task) => ({
      id: `task.${task.id}`,
      resource: "tasks" as const,
      record_id: task.id,
      title: task.text,
      subtitle: contactLabels.get(task.contact_id) ?? null,
      content: null,
      company_id: null,
      contact_id: task.contact_id,
      deal_id: null,
      date: task.due_date ?? null,
    })),
    ...contactNotes.map((note) => ({
      id: `contactNote.${note.id}`,
      resource: "contact_notes" as const,
      record_id: note.id,
      title: note.text,
      subtitle: contactLabels.get(note.contact_id) ?? null,
      content: null,
      company_id: null,
      contact_id: note.contact_id,
      deal_id: null,
      date: note.date ?? null,
    })),
    ...dealNotes.map((note) => ({
      id: `dealNote.${note.id}`,
      resource: "deal_notes" as const,
      record_id: note.id,
      title: note.text,
      subtitle: dealLabels.get(note.deal_id) ?? null,
      content: null,
      company_id: null,
      contact_id: null,
      deal_id: note.deal_id,
      date: note.date ?? null,
    })),
  ];

  return rows.sort(byDateDesc).slice(0, MAX_RESULTS);
}
