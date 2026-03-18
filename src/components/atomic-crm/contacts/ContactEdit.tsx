import { Card, CardContent } from "@/components/ui/card";
import { EditBase, Form, useEditContext } from "ra-core";

import type { Contact } from "../types";
import { ContactAside } from "./ContactAside";
import { ContactInputs } from "./ContactInputs";
import { FormToolbar } from "../layout/FormToolbar";

const transformContact = (data: Contact) => {
  const cleanedEmailJsonb =
    data.email_jsonb?.filter((e) => e.email !== null) || [];
  const cleanedPhoneJsonb =
    data.phone_jsonb?.filter((p) => p.number !== null) || [];
  return {
    ...data,
    phone_jsonb: cleanedPhoneJsonb.length > 0 ? cleanedPhoneJsonb : null,
    email_jsonb: cleanedEmailJsonb.length > 0 ? cleanedEmailJsonb : null,
  };
};

export const ContactEdit = () => (
  <EditBase redirect="show" transform={transformContact}>
    <ContactEditContent />
  </EditBase>
);

const normalizeContactArrayFields = (record: Contact) => ({
  ...record,
  email_jsonb:
    record.email_jsonb && record.email_jsonb.length > 0
      ? record.email_jsonb
      : [{ email: null, type: null }],
  phone_jsonb:
    record.phone_jsonb && record.phone_jsonb.length > 0
      ? record.phone_jsonb
      : [{ number: null, type: null }],
});

const ContactEditContent = () => {
  const { isPending, record } = useEditContext<Contact>();
  if (isPending || !record) return null;
  return (
    <div className="mt-2 flex gap-8">
      <Form
        className="flex flex-1 flex-col gap-4"
        record={normalizeContactArrayFields(record)}
      >
        <Card>
          <CardContent>
            <ContactInputs />
            <FormToolbar />
          </CardContent>
        </Card>
      </Form>

      <ContactAside link="show" />
    </div>
  );
};
