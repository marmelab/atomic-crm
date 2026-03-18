import { CreateBase, Form, useGetIdentity } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";

import { ContactInputs } from "./ContactInputs";
import { FormToolbar } from "../layout/FormToolbar";
import { cleanupContactForCreate, defaultEmailJsonb } from "./cleanupContact";

export const ContactCreate = () => {
  const { identity } = useGetIdentity();

  return (
    <CreateBase redirect="show" transform={cleanupContactForCreate}>
      <div className="mt-2 flex lg:mr-72">
        <div className="flex-1">
          <Form
            defaultValues={{
              sales_id: identity?.id,
              email_jsonb: defaultEmailJsonb,
              phone_jsonb: defaultEmailJsonb,
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
