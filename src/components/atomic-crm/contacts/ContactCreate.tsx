import { CreateBase, Form, useGetIdentity, type MutationMode } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";

import { ContactInputs } from "./ContactInputs";
import { FormToolbar } from "../layout/FormToolbar";
import {
  cleanupContactForCreate,
  defaultEmailJsonb,
  defaultPhoneJsonb,
} from "./contactModel";
import { useTypedCompany } from "./useTypedCompany";

export const ContactCreate = ({
  mutationMode,
}: {
  mutationMode?: MutationMode;
}) => {
  const { identity } = useGetIdentity();
  const withTypedCompany = useTypedCompany();

  return (
    <CreateBase
      redirect="show"
      transform={async (data) =>
        cleanupContactForCreate(await withTypedCompany(data))
      }
      mutationMode={mutationMode}
    >
      <div className="mt-2 flex lg:mr-72">
        <div className="flex-1">
          <Form
            defaultValues={{
              sales_id: identity?.id,
              email_jsonb: defaultEmailJsonb,
              phone_jsonb: defaultPhoneJsonb,
            }}
          >
            <Card>
              <CardContent>
                <ContactInputs />
                <FormToolbar />
              </CardContent>
            </Card>
          </Form>
        </div>
      </div>
    </CreateBase>
  );
};
