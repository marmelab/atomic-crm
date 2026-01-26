import { SaveButton } from "@/components/admin";
import {
  CreateBase,
  Form,
  RecordRepresentation,
  useDataProvider,
  useGetIdentity,
  useGetOne,
  useNotify,
  useRecordFromLocation,
  useRedirect,
  useUpdate,
} from "ra-core";
import { MobileContent } from "../layout/MobileContent";
import MobileHeader from "../layout/MobileHeader";
import { MobileBackButton } from "../misc/MobileBackButton";
import { TaskFormContent } from "./TaskFormContent";

export const MobileTaskCreate = () => {
  const { identity } = useGetIdentity();
  const dataProvider = useDataProvider();
  const [update] = useUpdate();
  const notify = useNotify();
  const redirect = useRedirect();
  const recordFromLocation = useRecordFromLocation();
  const contact_id = recordFromLocation?.contact_id;
  const selectContact = contact_id == null;

  const { data: contact } = useGetOne(
    "contacts",
    { id: contact_id! },
    { enabled: !!contact_id },
  );

  const handleSuccess = async (data: any) => {
    const contact = await dataProvider.getOne("contacts", {
      id: data.contact_id,
    });
    if (!contact.data) return;

    await update("contacts", {
      id: contact.data.id,
      data: { last_seen: new Date().toISOString() },
      previousData: contact.data,
    });

    notify("Task added");
    redirect(
      selectContact ? "list" : "show",
      selectContact ? "tasks" : "contacts",
      selectContact ? undefined : contact_id,
    );
  };

  if (!identity) return null;

  return (
    <CreateBase
      record={{
        type: "None",
        contact_id: contact?.id,
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
      mutationOptions={{ onSuccess: handleSuccess }}
    >
      <MobileHeader>
        <MobileBackButton />
        <div className="flex flex-1">
          <h1 className="text-xl font-semibold text-ellipsis overflow-hidden whitespace-nowrap">
            {!selectContact ? "Create Task for " : "Create Task"}
            {!selectContact && (
              <RecordRepresentation record={contact} resource="contacts" />
            )}
          </h1>
        </div>
      </MobileHeader>
      <MobileContent>
        <Form>
          <TaskFormContent selectContact={selectContact} />
          <div className="flex flex-col gap-2 mt-6">
            <SaveButton />
          </div>
        </Form>
      </MobileContent>
    </CreateBase>
  );
};
