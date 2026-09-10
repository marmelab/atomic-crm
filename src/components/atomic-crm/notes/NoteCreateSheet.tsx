import {
  type Identifier,
  useDataProvider,
  useGetIdentity,
  useGetOne,
  useGetRecordRepresentation,
  useNotify,
  useRedirect,
  useTranslate,
  useUpdate,
} from "ra-core";
import { CreateSheet } from "../misc/CreateSheet";
import { foreignKeyMapping } from "./foreignKeyMapping";
import { NoteInputsMobile } from "./NoteInputsMobile";
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
  const getContactRepresentation = useGetRecordRepresentation("contacts");
  const defaultStatus = selectContact ? undefined : contact?.status;

  if (!identity) return null;

  const handleSuccess = async (data: any) => {
    notify("resources.notes.added", {
      messageArgs: {
        _: "Note added",
      },
    });
    onOpenChange(false);

    const referenceRecordId = data[foreignKeyMapping["contacts"]];
    if (!referenceRecordId) return;
    redirect("show", "contacts", referenceRecordId);

    try {
      const { data: contact } = await dataProvider.getOne("contacts", {
        id: referenceRecordId,
      });
      if (!contact) return;
      await update(
        "contacts",
        {
          id: referenceRecordId as unknown as Identifier,
          data: { last_seen: new Date().toISOString(), status: data.status },
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
      resource="contact_notes"
      title={
        <span className="text-xl font-semibold truncate">
          {!selectContact
            ? translate("resources.notes.sheet.create_for", {
                name: getContactRepresentation(contact!),
              })
            : translate("resources.notes.sheet.create")}
        </span>
      }
      redirect={false}
      defaultValues={{ sales_id: identity?.id }}
      transform={(data: any) => ({
        ...data,
        [foreignKeyMapping["contacts"]]:
          contact_id ?? data[foreignKeyMapping["contacts"]],
        sales_id: identity.id,
        date: new Date(data.date || getCurrentDate()).toISOString(),
        status: defaultStatus,
      })}
      mutationOptions={{ onSuccess: handleSuccess }}
      open={open}
      onOpenChange={onOpenChange}
    >
      <NoteInputsMobile selectContact={selectContact} />
    </CreateSheet>
  );
};
