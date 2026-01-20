import { Card, CardContent } from "@/components/ui/card";
import { CreateBase, Form, useGetIdentity } from "ra-core";

import { SaveButton } from "@/components/admin";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileContent } from "../layout/MobileContent";
import MobileHeader from "../layout/MobileHeader";
import { ListButton } from "../misc/ListButton";
import type { Contact } from "../types";
import { ContactInputs } from "./ContactInputs";
import { FormToolbar } from "../layout/FormToolbar";

export const ContactCreate = () => {
  const isMobile = useIsMobile();
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
      {isMobile ? <ContactCreateContentMobile /> : <ContactCreateContent />}
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

const ContactCreateContentMobile = () => {
  const { identity } = useGetIdentity();
  return (
    <div>
      <MobileHeader>
        <ListButton />
        <div className="flex flex-1 text-xl font-semibold">Create Contact</div>
      </MobileHeader>
      <MobileContent>
        <Form defaultValues={{ sales_id: identity?.id }}>
          <ContactInputs />
          <div className="flex flex-col gap-2 mt-4">
            <SaveButton />
          </div>
        </Form>
      </MobileContent>
    </div>
  );
};
