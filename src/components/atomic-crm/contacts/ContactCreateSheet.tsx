import { useGetIdentity, useTranslate } from "ra-core";
import { CreateSheet, type CreateSheetProps } from "../misc/CreateSheet";
import { ContactInputs } from "./ContactInputs";
import {
  cleanupContactForCreate,
  defaultEmailJsonb,
  defaultPhoneJsonb,
} from "./contactModel";

export interface ContactCreateSheetProps
  extends Pick<CreateSheetProps, "mutationOptions" | "redirect"> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: CreateSheetProps["defaultValues"];
}

export const ContactCreateSheet = ({
  open,
  onOpenChange,
  defaultValues,
  mutationOptions,
  redirect,
}: ContactCreateSheetProps) => {
  const { identity } = useGetIdentity();
  const translate = useTranslate();
  return (
    <CreateSheet
      resource="contacts"
      title={translate("resources.contacts.action.new")}
      defaultValues={{
        sales_id: identity?.id,
        email_jsonb: defaultEmailJsonb,
        phone_jsonb: defaultPhoneJsonb,
        ...defaultValues,
      }}
      transform={cleanupContactForCreate}
      open={open}
      onOpenChange={onOpenChange}
      mutationOptions={mutationOptions}
      redirect={redirect}
    >
      <ContactInputs />
    </CreateSheet>
  );
};
