import {
  type Identifier,
  useDataProvider,
  useGetIdentity,
  useGetOne,
  useGetRecordRepresentation,
  useNotify,
  useTranslate,
  useUpdate,
} from "ra-core";
import type { Task } from "../types";
import { CreateSheet } from "../misc/CreateSheet";
import { TaskFormContent } from "./TaskFormContent";

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
  const notify = useNotify();

  if (!identity) return null;

  const handleSuccess = async (data: Task) => {
    notify("resources.tasks.added");
    // No redirect, only close the sheet
    onOpenChange(false);

    if (!data.contact_id) return;

    try {
      const { data: contact } = await dataProvider.getOne("contacts", {
        id: data.contact_id,
      });
      if (!contact) return;
      await update(
        "contacts",
        {
          id: data.contact_id,
          data: { last_seen: new Date().toISOString() },
          previousData: contact,
        },
        { returnPromise: true },
      );
    } catch (error) {
      console.error("Could not update the contact last_seen date", error);
    }
  };

  return (
    <CreateSheet
      resource="tasks"
      title={
        <span className="text-xl font-semibold truncate pr-10">
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
        due_date: new Date().toISOString(),
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
