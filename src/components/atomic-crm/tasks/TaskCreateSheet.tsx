import {
  type Identifier,
  useDataProvider,
  useGetIdentity,
  useGetOne,
  useGetRecordRepresentation,
  useRedirect,
  useTranslate,
  useUpdate,
} from "ra-core";
import { CreateSheet } from "../misc/CreateSheet";
import { foreignKeyMapping } from "../notes/foreignKeyMapping";
import { TaskFormContent } from "./TaskFormContent";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export interface TaskCreateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact_id?: Identifier;
}

export const TaskCreateSheet = ({
  open,
  onOpenChange,
  contact_id,
}: TaskCreateSheetProps) => {
  const { identity } = useGetIdentity();
  const translate = useTranslate();
  const getContactRepresentation = useGetRecordRepresentation("contacts");

  const selectContact = contact_id == null;
  const { data: contact } = useGetOne(
    "contacts",
    { id: contact_id! },
    { enabled: !selectContact },
  );
  const [update] = useUpdate();
  const dataProvider = useDataProvider();
  const queryClient = useQueryClient();
  const redirect = useRedirect();
  // Set once per opening: a new due_date on each render would make ra-core
  // reset the form, wiping what the user already typed.
  const [dueDate, setDueDate] = useState(() => new Date().toISOString());
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDueDate(new Date().toISOString());
  }

  if (!identity) return null;

  const handleSuccess = async (data: any) => {
    const referenceRecordId = data[foreignKeyMapping["contacts"]];
    if (!referenceRecordId) return;
    const { data: contact } = await dataProvider.getOne("contacts", {
      id: referenceRecordId,
    });
    if (!contact) return;
    await update("contacts", {
      id: referenceRecordId as unknown as Identifier,
      data: { last_seen: new Date().toISOString() },
      previousData: contact,
    });
    queryClient.invalidateQueries({
      queryKey: ["contacts", "getOne"],
    });

    if (!selectContact) {
      redirect(`/contacts/${contact_id}/show?tab=tasks`);
    }
    onOpenChange(false);
  };

  return (
    <CreateSheet
      resource="tasks"
      title={
        <span className="text-xl font-semibold truncate">
          {!selectContact
            ? translate("resources.tasks.dialog.create_for", {
                name: getContactRepresentation(contact!),
              })
            : translate("resources.tasks.dialog.create")}
        </span>
      }
      redirect={false}
      record={{
        type: "none",
        contact_id,
        due_date: dueDate,
        sales_id: identity.id,
      }}
      mutationOptions={{
        onSuccess: handleSuccess,
      }}
      open={open}
      onOpenChange={onOpenChange}
    >
      <TaskFormContent selectContact={selectContact} />
    </CreateSheet>
  );
};
