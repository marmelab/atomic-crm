import {
  type Identifier,
  RecordRepresentation,
  useDataProvider,
  useGetIdentity,
  useGetOne,
  useNotify,
  useUpdate,
} from "ra-core";
import { CreateSheet } from "../misc/CreateSheet";
import { foreignKeyMapping } from "../notes/foreignKeyMapping";
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

  const handleSuccess = async (data: any) => {
    const referenceRecordId = data[foreignKeyMapping["contacts"]];
    if (!referenceRecordId) return;
    const { data: contact } = await dataProvider.getOne("contacts", {
      id: referenceRecordId,
    });
    if (!contact) return;
    update("contacts", {
      id: referenceRecordId as unknown as Identifier,
      data: { last_seen: new Date().toISOString() },
      previousData: contact,
    });
    notify("Task added");
    // No redirect, only close the sheet
    onOpenChange(false);
  };

  return (
    <CreateSheet
      resource="tasks"
      title={
        <h1 className="text-xl font-semibold truncate pr-10">
          {!selectContact ? "Create Task for " : "Create Task"}
          {!selectContact && (
            <RecordRepresentation record={contact} resource="contacts" />
          )}
        </h1>
      }
      redirect={false}
      record={{
        type: "None",
        contact_id,
        due_date: new Date().toISOString().slice(0, 10),
        sales_id: identity.id,
      }}
      transform={(data) => {
        const dueDate = new Date(data.due_date);
        dueDate.setHours(0, 0, 0, 0);
        return {
          ...data,
          due_date: dueDate.toISOString(),
        };
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
