import { Card, CardContent } from "@/components/ui/card";
import { EditBase, Form, useEditContext } from "ra-core";

import type { Contact } from "../types";
import { ContactAside } from "./ContactAside";
import { ContactInputs } from "./ContactInputs";
import { FormToolbar } from "../layout/FormToolbar";

export const ContactEdit = () => (
  <EditBase redirect="show">
    <ContactEditContent />
  </EditBase>
);

const ContactEditContent = () => {
  const { isPending, record } = useEditContext<Contact>();
  if (isPending || !record) return null;
  return (
    <div className="mt-4 flex gap-6">
      <Form className="flex flex-1 flex-col gap-4">
        <Card>
          <CardContent>
            <div className="pb-4 mb-4 border-b border-border">
              <h2 className="text-xl font-semibold">Edit Contact</h2>
            </div>
            <ContactInputs />
            <div className="pt-4 mt-4 border-t border-border">
              <FormToolbar />
            </div>
          </CardContent>
        </Card>
      </Form>

      <ContactAside link="show" />
    </div>
  );
};
