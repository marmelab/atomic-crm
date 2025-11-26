import jsonExport from "jsonexport/dist";
import {
  downloadCSV,
  useGetIdentity,
  useListContext,
  type Exporter,
} from "ra-core";
import { BulkActionsToolbar } from "@/components/admin/bulk-actions-toolbar";
import { CreateButton } from "@/components/admin/create-button";
import { ExportButton } from "@/components/admin/export-button";
import { List, ListView } from "@/components/admin/list";
import { SortButton } from "@/components/admin/sort-button";
import { Card } from "@/components/ui/card";

import type { Company, Contact, Sale, Tag } from "../types";
import { ContactEmpty } from "./ContactEmpty";
import { ContactImportButton } from "./ContactImportButton";
import { ContactListContent } from "./ContactListContent";
import { ContactListFilter } from "./ContactListFilter";
import { TopToolbar } from "../layout/TopToolbar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Link } from "react-router";
import { InfiniteListBase } from "ra-core";
import { InfinitePagination } from "../misc/InfinitePagination";

export const ContactList = () => {
  const { identity } = useGetIdentity();
  const isMobile = useIsMobile();

  if (!identity) return null;

  if (isMobile) {
    return (
      <InfiniteListBase
        perPage={25}
        sort={{ field: "last_seen", order: "DESC" }}
        exporter={exporter}
      >
        <ListView pagination={<InfinitePagination />} actions={false}>
          <ContactListLayout />
        </ListView>
        <Button
          variant="default"
          size="icon"
          className="rounded-full fixed bottom-12 right-12 w-12 h-12"
          asChild
        >
          <Link to="/contacts/create">
            <span className="sr-only">Create new contact</span>
            <Plus />
          </Link>
        </Button>
      </InfiniteListBase>
    );
  }

  return (
    <List
      title={false}
      actions={<ContactListActions />}
      perPage={25}
      sort={{ field: "last_seen", order: "DESC" }}
      exporter={exporter}
    >
      <ContactListLayout />
    </List>
  );
};

const ContactListLayout = () => {
  const { data, isPending, filterValues } = useListContext();
  const { identity } = useGetIdentity();
  const isMobile = useIsMobile();

  const hasFilters = filterValues && Object.keys(filterValues).length > 0;

  if (!identity || isPending) return null;

  if (!data?.length && !hasFilters) return <ContactEmpty />;

  return (
    <div className="flex flex-row gap-8">
      {isMobile ? null : <ContactListFilter />}
      <div className="w-full flex flex-col gap-4">
        <Card className="py-0">
          <ContactListContent />
        </Card>
      </div>
      {isMobile ? null : <BulkActionsToolbar />}
    </div>
  );
};

const ContactListActions = () => {
  const isMobile = useIsMobile();
  return (
    <TopToolbar>
      <SortButton fields={["first_name", "last_name", "last_seen"]} />
      {isMobile ? null : (
        <>
          <ContactImportButton />
          <ExportButton exporter={exporter} />
          <CreateButton />
        </>
      )}
    </TopToolbar>
  );
};

const exporter: Exporter<Contact> = async (records, fetchRelatedRecords) => {
  const companies = await fetchRelatedRecords<Company>(
    records,
    "company_id",
    "companies",
  );
  const sales = await fetchRelatedRecords<Sale>(records, "sales_id", "sales");
  const tags = await fetchRelatedRecords<Tag>(records, "tags", "tags");

  const contacts = records.map((contact) => {
    const exportedContact = {
      ...contact,
      company:
        contact.company_id != null
          ? companies[contact.company_id].name
          : undefined,
      sales: `${sales[contact.sales_id].first_name} ${
        sales[contact.sales_id].last_name
      }`,
      tags: contact.tags.map((tagId) => tags[tagId].name).join(", "),
      email_work: contact.email_jsonb?.find((email) => email.type === "Work")
        ?.email,
      email_home: contact.email_jsonb?.find((email) => email.type === "Home")
        ?.email,
      email_other: contact.email_jsonb?.find((email) => email.type === "Other")
        ?.email,
      email_jsonb: JSON.stringify(contact.email_jsonb),
      email_fts: undefined,
      phone_work: contact.phone_jsonb?.find((phone) => phone.type === "Work")
        ?.number,
      phone_home: contact.phone_jsonb?.find((phone) => phone.type === "Home")
        ?.number,
      phone_other: contact.phone_jsonb?.find((phone) => phone.type === "Other")
        ?.number,
      phone_jsonb: JSON.stringify(contact.phone_jsonb),
      phone_fts: undefined,
    };
    delete exportedContact.email_fts;
    delete exportedContact.phone_fts;
    return exportedContact;
  });
  return jsonExport(contacts, {}, (_err: any, csv: string) => {
    downloadCSV(csv, "contacts");
  });
};
