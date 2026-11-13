import { ReferenceManyField } from "@/components/admin/reference-many-field";
import { RecordContextProvider, useListContext, useTranslate } from "ra-core";
import { Link, useLocation } from "react-router";

import { Avatar } from "../contacts/Avatar";
import { AsideSection } from "../misc/AsideSection";
import { Status } from "../misc/Status";
import type { Company, Contact } from "../types";

export const CompanyContactsMobile = ({ record }: { record: Company }) => {
  const translate = useTranslate();
  if (!record.nb_contacts) return null;

  return (
    <AsideSection
      title={translate("resources.contacts.name", { smart_count: 2 })}
      noGap
    >
      <ReferenceManyField
        reference="contacts_summary"
        target="company_id"
        sort={{ field: "last_name", order: "ASC" }}
      >
        <CompanyContactsIteratorMobile />
      </ReferenceManyField>
    </AsideSection>
  );
};

const CompanyContactsIteratorMobile = () => {
  const location = useLocation();
  const { data: contacts, error, isPending } = useListContext<Contact>();
  if (isPending || error) return null;

  return contacts.map((contact) => (
    <RecordContextProvider key={contact.id} value={contact}>
      <Link
        to={`/contacts/${contact.id}/show`}
        state={{ from: location.pathname }}
        className="flex flex-row gap-4 items-center py-2 hover:bg-muted transition-colors"
      >
        <Avatar />
        <div className="flex-1 min-w-0">
          <div className="flex justify-between gap-2">
            <div className="font-medium truncate">
              {`${contact.first_name} ${contact.last_name ?? ""}`}
            </div>
            <Status status={contact.status} />
          </div>
          {contact.title && (
            <div className="text-muted-foreground truncate">
              {contact.title}
            </div>
          )}
        </div>
      </Link>
    </RecordContextProvider>
  ));
};
