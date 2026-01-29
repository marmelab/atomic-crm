import { Card, CardContent } from "@/components/ui/card";
import { CreateBase, Form, useGetIdentity } from "ra-core";

import { FormToolbar } from "../layout/FormToolbar";
import type { Contact } from "../types";
import { ContactInputs } from "./ContactInputs";

export const ContactCreate = () => {
  return (
    <CreateBase
      redirect="show"
      transform={(data: Contact) => ({
        ...data,
        first_seen: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        tags: [],
      })}
    >
      <ContactCreateContent />
    </CreateBase>
  );
};

const ContactCreateContent = () => {
  const { identity } = useGetIdentity();
  return (
    <div className="mt-2 flex lg:mr-72">
      <div className="flex-1">
        <Form defaultValues={{ sales_id: identity?.id }}>
          <Card>
            <CardContent>
              <ContactInputs />
              <FormToolbar />
            </CardContent>
          </Card>
        </Form>
      </div>
    </div>
  );
};
