import { useGetIdentity } from "ra-core";
import { CreateSheet } from "../misc/CreateSheet";
import { ContactInputs } from "./ContactInputs";
import type { Contact } from "../types";

export interface ContactCreateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ContactCreateSheet = ({
  open,
  onOpenChange,
}: ContactCreateSheetProps) => {
  const { identity } = useGetIdentity();
  return (
    <CreateSheet
      resource="contacts"
      title="Create Contact"
      defaultValues={{ sales_id: identity?.id }}
      transform={(data: Contact) => ({
        ...data,
        first_seen: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        tags: [],
      })}
      open={open}
      onOpenChange={onOpenChange}
    >
      <ContactInputs />
    </CreateSheet>
  );
};
