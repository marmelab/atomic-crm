import { CreateBase, Form, useGetIdentity, useTranslate } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CancelButton } from "@/components/admin/cancel-button";
import { SaveButton } from "@/components/admin/form";

import { CompanyContactsInputs } from "./CompanyContactsInputs";
import { CompanyInputs } from "./CompanyInputs";
import { omitContactSearch } from "./companyForm";

export const CompanyCreate = () => {
  const { identity } = useGetIdentity();
  const translate = useTranslate();

  return (
    <CreateBase redirect="show" transform={omitContactSearch}>
      <div className="mt-2 flex lg:mr-72">
        <div className="flex-1">
          <Form
            defaultValues={{
              sales_id: identity?.id,
              lead_date: new Date().toLocaleDateString("en-CA"),
              contacts: [],
            }}
          >
            <Card>
              <CardContent className="flex flex-col gap-6">
                <CompanyInputs />
                <Separator />
                <CompanyContactsInputs />
                <div
                  role="toolbar"
                  className="sticky flex pt-4 pb-4 md:pb-0 bottom-0 bg-linear-to-b from-transparent to-card to-10% flex-row justify-end gap-2"
                >
                  <CancelButton />
                  <SaveButton
                    label={translate("resources.companies.action.create", {
                      _: "Create Company",
                    })}
                  />
                </div>
              </CardContent>
            </Card>
          </Form>
        </div>
      </div>
    </CreateBase>
  );
};
