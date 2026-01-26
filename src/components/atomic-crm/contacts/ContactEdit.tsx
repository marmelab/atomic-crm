import { Card, CardContent } from "@/components/ui/card";
import {
  EditBase,
  Form,
  RecordRepresentation,
  useCreatePath,
  useEditContext,
} from "ra-core";

import { useIsMobile } from "@/hooks/use-mobile";
import { FormToolbar } from "../layout/FormToolbar";
import { MobileContent } from "../layout/MobileContent";
import MobileHeader from "../layout/MobileHeader";
import { MobileBackButton } from "../misc/MobileBackButton";
import type { Contact } from "../types";
import { ContactAside } from "./ContactAside";
import { ContactInputs } from "./ContactInputs";
import { DeleteButton, SaveButton } from "@/components/admin";

export const ContactEdit = () => {
  const isMobile = useIsMobile();
  return (
    <EditBase redirect="show">
      {isMobile ? <ContactEditContentMobile /> : <ContactEditContent />}
    </EditBase>
  );
};

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

const ContactEditContentMobile = () => {
  const { isPending, record } = useEditContext<Contact>();
  const createPath = useCreatePath();
  const to = createPath({
    resource: "contacts",
    type: "show",
    id: record?.id,
  });
  if (isPending || !record) return null;
  return (
    <div>
      <MobileHeader>
        <MobileBackButton to={to} />
        <div className="flex flex-1 text-xl font-semibold text-ellipsis overflow-hidden whitespace-nowrap">
          Edit <RecordRepresentation />
        </div>
      </MobileHeader>
      <MobileContent>
        <Form className="flex flex-1 flex-col gap-4">
          <ContactInputs />
          <div className="flex flex-col gap-2 mt-4">
            <SaveButton />
            <DeleteButton />
          </div>
        </Form>
      </MobileContent>
    </div>
  );
};
