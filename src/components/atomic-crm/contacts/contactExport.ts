import jsonExport from "jsonexport/dist";
import { downloadCSV, type Exporter, type Identifier } from "ra-core";

import type { Company, Contact, Sale, Tag } from "../types";

type ContactExportRecord = Contact & {
  company_name?: string;
  email_fts?: string;
  phone_fts?: string;
};

type RelatedRecordMap<T extends { id: Identifier }> = Record<string, T>;

const getRelatedRecord = <T extends { id: Identifier }>(
  records: RelatedRecordMap<T>,
  id: Identifier | null | undefined,
) => {
  if (id == null) {
    return undefined;
  }

  return records[String(id)];
};

const getSaleName = (sale?: Sale) => {
  const name = [sale?.first_name, sale?.last_name]
    .filter((value): value is string => value != null && value.length > 0)
    .join(" ");

  return name.length > 0 ? name : undefined;
};

const exportContactsToCsv = async (contacts: ReturnType<typeof buildContactsExportRows>) =>
  new Promise<string>((resolve, reject) => {
    jsonExport(contacts, {}, (error, csv) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(csv);
    });
  });

export const buildContactsExportRows = (
  records: ContactExportRecord[],
  {
    companies,
    sales,
    tags,
  }: {
    companies: RelatedRecordMap<Company>;
    sales: RelatedRecordMap<Sale>;
    tags: RelatedRecordMap<Tag>;
  },
) =>
  records.map((contact) => {
    const company =
      getRelatedRecord(companies, contact.company_id)?.name ?? contact.company_name;
    const salesName = getSaleName(getRelatedRecord(sales, contact.sales_id));
    const tagNames = (contact.tags ?? [])
      .map((tagId) => getRelatedRecord(tags, tagId)?.name)
      .filter((value): value is string => value != null)
      .join(", ");

    const exportedContact = {
      ...contact,
      company,
      sales: salesName,
      tags: tagNames,
      email_work: contact.email_jsonb?.find((email) => email.type === "Work")
        ?.email,
      email_home: contact.email_jsonb?.find((email) => email.type === "Home")
        ?.email,
      email_other: contact.email_jsonb?.find((email) => email.type === "Other")
        ?.email,
      email_jsonb: JSON.stringify(contact.email_jsonb),
      phone_work: contact.phone_jsonb?.find((phone) => phone.type === "Work")
        ?.number,
      phone_home: contact.phone_jsonb?.find((phone) => phone.type === "Home")
        ?.number,
      phone_other: contact.phone_jsonb?.find((phone) => phone.type === "Other")
        ?.number,
      phone_jsonb: JSON.stringify(contact.phone_jsonb),
    };

    delete exportedContact.email_fts;
    delete exportedContact.phone_fts;

    return exportedContact;
  });

export const contactExporter: Exporter<ContactExportRecord> = async (
  records,
  fetchRelatedRecords,
) => {
  const [companies, sales, tags] = await Promise.all([
    fetchRelatedRecords<Company>(records, "company_id", "companies"),
    fetchRelatedRecords<Sale>(records, "sales_id", "sales"),
    fetchRelatedRecords<Tag>(records, "tags", "tags"),
  ]);

  const csv = await exportContactsToCsv(
    buildContactsExportRows(records, {
      companies: companies as RelatedRecordMap<Company>,
      sales: sales as RelatedRecordMap<Sale>,
      tags: tags as RelatedRecordMap<Tag>,
    }),
  );

  downloadCSV(csv, "contacts");
};
