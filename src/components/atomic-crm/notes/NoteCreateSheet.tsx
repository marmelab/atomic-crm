import {
  type Identifier,
  RecordRepresentation,
  useDataProvider,
  useGetIdentity,
  useGetOne,
  useNotify,
  useRedirect,
  useTranslate,
  useUpdate,
} from "ra-core";
import { CreateSheet } from "../misc/CreateSheet";
import { foreignKeyMapping } from "./foreignKeyMapping";
import { NoteInputs } from "./NoteInputs";
import { getCurrentDate } from "./utils";

export interface NoteCreateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact_id?: Identifier;
}

export const NoteCreateSheet = ({
  open,
  onOpenChange,
  contact_id,
}: NoteCreateSheetProps) => {
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
  const redirect = useRedirect();
  const translate = useTranslate();

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
      data: { last_seen: new Date().toISOString(), status: data.status },
      previousData: contact,
    });
    notify("crm.notes.added", {
      messageArgs: {
        _: "Note added",
      },
    });
    redirect("show", "contacts", referenceRecordId);
    onOpenChange(false);
  };

  return (
    <CreateSheet
      resource="contact_notes"
      title={
        <h1 className="text-xl font-semibold truncate pr-10">
          {!selectContact
            ? translate("crm.notes.sheet.create_for", {
                _: "Create note for",
              })
            : translate("crm.notes.sheet.create", { _: "Create note" })}
          {!selectContact && (
            <>
              {" "}
              <RecordRepresentation record={contact} resource="contacts" />
            </>
          )}
        </h1>
      }
      redirect={false}
      defaultValues={{ sales_id: identity?.id }}
      transform={(data: any) => ({
        ...data,
        [foreignKeyMapping["contacts"]]:
          contact_id ?? data[foreignKeyMapping["contacts"]],
        sales_id: identity.id,
        date: new Date(data.date || getCurrentDate()).toISOString(),
      })}
      mutationOptions={{
        onSuccess: handleSuccess,
      }}
      open={open}
      onOpenChange={onOpenChange}
    >
      <NoteInputs
        showStatus
        reference="contacts"
        selectReference={selectContact}
      />
    </CreateSheet>
  );
};
