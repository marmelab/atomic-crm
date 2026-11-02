import {
  EditBase,
  Form,
  useGetList,
  useRecordContext,
  useTranslate,
} from "ra-core";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

import { toCompanyContactInput } from "../providers/commons/companyContacts";
import type { Company, Contact } from "../types";
import { CompanyContactsInputs } from "./CompanyContactsInputs";
import { CompanyInputs } from "./CompanyInputs";
import { CompanyAside } from "./CompanyAside";
import { omitContactSearch } from "./companyForm";
import { FormToolbar } from "../layout/FormToolbar";

export const CompanyEdit = () => (
  <EditBase
    actions={false}
    redirect="show"
    // the contacts are saved with the company: wait for the save so a refused
    // contact list shows its error instead of being undone silently
    mutationMode="pessimistic"
    transform={omitContactSearch}
  >
    <div className="mt-2 flex gap-8">
      <CompanyEditForm />

      <CompanyAside link="show" />
    </div>
  </EditBase>
);

const CompanyEditForm = () => {
  const record = useRecordContext<Company>();
  const translate = useTranslate();
  const { data, total, isPending, error } = useGetList<Contact>(
    "contacts",
    {
      filter: { company_id: record?.id },
      pagination: { page: 1, perPage: 500 },
      sort: { field: "id", order: "ASC" },
    },
    { enabled: record?.id != null },
  );

  // The form keeps its first default values: render it once the company's
  // contacts are known, so they load into the list.
  if (!record || isPending) {
    return <Skeleton className="flex-1 h-96" />;
  }

  // Without a contact list in the form, saving leaves the contacts untouched:
  // a list that failed to load, or only partly loaded, would unlink the rest.
  const canManageContacts =
    !error && data != null && (total == null || total <= data.length);

  return (
    <Form
      className="flex flex-1 flex-col gap-4 pb-2"
      defaultValues={
        canManageContacts
          ? { contacts: (data ?? []).map(toCompanyContactInput) }
          : {}
      }
    >
      <Card>
        <CardContent className="flex flex-col gap-6">
          <CompanyInputs />
          <Separator />
          {!canManageContacts ? (
            <p className="text-sm text-destructive">
              {translate("resources.companies.contacts.load_error", {
                _: "Could not load this company's contacts. Reload the page to manage them.",
              })}
            </p>
          ) : (
            <CompanyContactsInputs />
          )}
          <FormToolbar />
        </CardContent>
      </Card>
    </Form>
  );
};
