import { Card, CardContent } from "@/components/ui/card";
import { EditBase, Form, useEditContext } from "ra-core";
import type { Contact } from "@/components/atomic-crm/types";
import { ContactAside } from "@/components/atomic-crm/contacts/ContactAside";
import { ContactInputs } from "@/components/atomic-crm/contacts/ContactInputs";
import { FormToolbar } from "@/components/atomic-crm/layout/FormToolbar";

export const ContactEdit = () => (
  <EditBase redirect="show">
    <ContactEditContent />
  </EditBase>
);

const ContactEditContent = () => {
  const { isPending, record } = useEditContext<Contact>();
  if (isPending || !record) return null;
  return (
    <div className="mt-2 flex gap-8">
      <Form className="flex flex-1 flex-col gap-4">
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
