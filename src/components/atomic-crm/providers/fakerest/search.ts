import type { DataProvider, Identifier } from "ra-core";

import type {
  Company,
  Contact,
  ContactNote,
  Deal,
  DealNote,
  SearchResourceName,
  SearchResult,
  Task,
} from "../../types";
import { getSearchTerms, matchesAllTerms } from "../../search/searchHighlight";
import { DESKTOP_SEARCH_RESOURCES } from "../../search/searchResources";

const DEFAULT_MAX_RESULTS = 50;
const TITLE_LENGTH = 200;

const getAll = async <T>(
  dataProvider: DataProvider,
  resource: string,
): Promise<T[]> => {
  const { data } = await dataProvider.getList<any>(resource, {
    filter: {},
    pagination: { page: 1, perPage: Number.MAX_SAFE_INTEGER },
    sort: { field: "id", order: "ASC" },
  });
  return data as T[];
};

const contactName = (contact: Pick<Contact, "first_name" | "last_name">) =>
  [contact.first_name, contact.last_name].filter(Boolean).join(" ");

// Same fields, same separator as the `content` column of `global_search`.
const joinFields = (...values: (string | null | undefined)[]) =>
  values.filter(Boolean).join(" · ") || null;

const attachmentTitles = (note: ContactNote | DealNote) =>
  note.attachments?.map((attachment) => attachment.title).join(" ");

const byDateDesc = (a: SearchResult, b: SearchResult) =>
  (b.date ?? "").localeCompare(a.date ?? "");

/** A result, plus the text its table's `fts` column indexes in Postgres. */
type Candidate = { result: SearchResult; document: string };

/**
 * Emulates the `global_search` database function for the FakeRest provider.
 *
 * It follows the same rules: the same fields per resource, every query word
 * must start a word of the record (accents and case ignored), open tasks and
 * live deals only, each resource's newest `maxResults` matches, then the
 * newest `maxResults` overall. It scans every record, which is fine for the
 * in-browser demo data.
 */
export async function getSearchResults(
  dataProvider: DataProvider,
  query: string,
  resources: readonly SearchResourceName[] = DESKTOP_SEARCH_RESOURCES,
  maxResults = DEFAULT_MAX_RESULTS,
): Promise<SearchResult[]> {
  const terms = getSearchTerms(query);
  if (terms.length === 0) {
    return [];
  }

  const [companies, contacts, deals, tasks, contactNotes, dealNotes] =
    await Promise.all([
      getAll<Company>(dataProvider, "companies"),
      getAll<Contact>(dataProvider, "contacts"),
      getAll<Deal>(dataProvider, "deals"),
      getAll<Task>(dataProvider, "tasks"),
      getAll<ContactNote>(dataProvider, "contact_notes"),
      getAll<DealNote>(dataProvider, "deal_notes"),
    ]);

  const companiesById = new Map<Identifier, Company>(
    companies.map((company) => [company.id, company]),
  );
  const contactsById = new Map<Identifier, Contact>(
    contacts.map((contact) => [contact.id, contact]),
  );
  const dealsById = new Map<Identifier, Deal>(
    deals.map((deal) => [deal.id, deal]),
  );
  const companyName = (id: Identifier | null | undefined) =>
    id != null ? (companiesById.get(id)?.name ?? null) : null;
  const contactLabel = (id: Identifier) => {
    const contact = contactsById.get(id);
    return contact ? contactName(contact) : null;
  };
  const liveDeals = deals.filter((deal) => !deal.archived_at);

  const candidates: Record<SearchResourceName, () => Candidate[]> = {
    companies: () =>
      companies.map((company) => {
        const content = joinFields(
          company.sector,
          company.description,
          company.website,
          company.phone_number,
          company.zipcode,
          company.city,
          company.state_abbr,
        );
        return {
          document: [company.name, content].join(" "),
          result: {
            resource: "companies",
            record_id: company.id,
            title: company.name,
            subtitle: company.sector ?? null,
            contact_id: null,
            deal_id: null,
            date: company.created_at ?? null,
            content,
          },
        };
      }),
    contacts: () =>
      contacts.map((contact) => {
        const content = joinFields(
          contact.title,
          contact.background,
          contact.email_jsonb?.map(({ email }) => email).join(" "),
          contact.phone_jsonb?.map(({ number }) => number).join(" "),
        );
        return {
          document: [contact.first_name, contact.last_name, content].join(" "),
          result: {
            resource: "contacts",
            record_id: contact.id,
            title: contactName(contact),
            subtitle: companyName(contact.company_id),
            contact_id: contact.id,
            deal_id: null,
            date: contact.first_seen ?? null,
            content,
          },
        };
      }),
    deals: () =>
      liveDeals.map((deal) => {
        const content = joinFields(deal.category, deal.description);
        return {
          document: [deal.name, content].join(" "),
          result: {
            resource: "deals",
            record_id: deal.id,
            title: deal.name,
            subtitle: companyName(deal.company_id),
            contact_id: null,
            deal_id: deal.id,
            date: deal.created_at ?? null,
            content,
          },
        };
      }),
    tasks: () =>
      tasks
        .filter((task) => !task.done_date)
        .map((task) => {
          const content = joinFields(task.text, task.type);
          return {
            document: content ?? "",
            result: {
              resource: "tasks",
              record_id: task.id,
              title: task.text?.slice(0, TITLE_LENGTH) ?? null,
              subtitle: contactLabel(task.contact_id),
              contact_id: task.contact_id,
              deal_id: null,
              date: task.created_at ?? null,
              content,
            },
          };
        }),
    contact_notes: () =>
      contactNotes.map((note) => {
        const content = joinFields(note.text, attachmentTitles(note));
        return {
          document: content ?? "",
          result: {
            resource: "contact_notes",
            record_id: note.id,
            title: note.text?.slice(0, TITLE_LENGTH) ?? null,
            subtitle: contactLabel(note.contact_id),
            contact_id: note.contact_id,
            deal_id: null,
            date: note.date ?? null,
            content,
          },
        };
      }),
    deal_notes: () =>
      dealNotes
        .filter((note) => {
          const deal = dealsById.get(note.deal_id);
          return deal != null && !deal.archived_at;
        })
        .map((note) => {
          const content = joinFields(note.text, attachmentTitles(note));
          return {
            document: content ?? "",
            result: {
              resource: "deal_notes",
              record_id: note.id,
              title: note.text?.slice(0, TITLE_LENGTH) ?? null,
              subtitle: dealsById.get(note.deal_id)?.name ?? null,
              contact_id: null,
              deal_id: note.deal_id,
              date: note.date ?? null,
              content,
            },
          };
        }),
  };

  return resources
    .flatMap((resource) =>
      candidates[resource]()
        .filter(({ document }) => matchesAllTerms(document, terms))
        .map(({ result }) => result)
        .sort(byDateDesc)
        .slice(0, maxResults),
    )
    .sort(byDateDesc)
    .slice(0, maxResults);
}
