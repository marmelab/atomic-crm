import { Plus } from "lucide-react";
import {
  CreateBase,
  Form,
  ListContextProvider,
  ResourceContextProvider,
  useGetList,
  useList,
  useNotify,
  useRecordContext,
} from "ra-core";
import { useState, Fragment } from "react";
import { useFormContext } from "react-hook-form";
import { SaveButton } from "@/components/admin/form";
import { TextInput } from "@/components/admin/text-input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import type { ClientNote } from "../types";
import { ClientNoteItem } from "../clients/ClientNoteItem";

export const SupplierNotesSection = () => {
  const record = useRecordContext();
  const [showCreate, setShowCreate] = useState(false);

  const {
    data: notes,
    isPending,
    refetch,
  } = useGetList<ClientNote>(
    "client_notes",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "date", order: "DESC" },
      filter: { supplier_id: record?.id },
    },
    { enabled: !!record?.id },
  );

  const listContext = useList({
    data: notes,
    isPending,
    resource: "client_notes",
  });

  if (!record) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Note
        </h3>
        <Button
          variant="outline"
          size="sm"
          className="h-6 cursor-pointer"
          onClick={() => setShowCreate(!showCreate)}
        >
          <Plus className="w-4 h-4" />
          Aggiungi nota
        </Button>
      </div>

      {showCreate && (
        <SupplierNoteCreate
          supplierId={record.id}
          onSuccess={() => {
            setShowCreate(false);
            refetch();
          }}
        />
      )}

      <ResourceContextProvider value="client_notes">
        <ListContextProvider value={listContext}>
          {notes && notes.length > 0 ? (
            <div className="space-y-4">
              {notes.map((note, index) => (
                <Fragment key={note.id}>
                  <ClientNoteItem note={note} />
                  {index < notes.length - 1 && <Separator />}
                </Fragment>
              ))}
            </div>
          ) : (
            !isPending && (
              <p className="text-sm text-muted-foreground">
                Nessuna nota per questo fornitore.
              </p>
            )
          )}
        </ListContextProvider>
      </ResourceContextProvider>
    </div>
  );
};

const SupplierNoteCreate = ({
  supplierId,
  onSuccess,
}: {
  supplierId: any;
  onSuccess: () => void;
}) => {
  const notify = useNotify();

  return (
    <CreateBase
      resource="client_notes"
      record={{
        supplier_id: supplierId,
        date: new Date().toISOString(),
      }}
      redirect={false}
      mutationOptions={{
        onSuccess: () => {
          notify("Nota aggiunta");
          onSuccess();
        },
      }}
    >
      <Form className="mb-4">
        <div className="space-y-2">
          <TextInput
            source="text"
            label={false}
            multiline
            helperText={false}
            placeholder="Scrivi una nota..."
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <ResetAndCancel onCancel={onSuccess} />
            <SaveButton label="Salva nota" />
          </div>
        </div>
      </Form>
    </CreateBase>
  );
};

const ResetAndCancel = ({ onCancel }: { onCancel: () => void }) => {
  const { reset } = useFormContext();
  return (
    <Button
      variant="ghost"
      type="button"
      className="cursor-pointer"
      onClick={() => {
        reset();
        onCancel();
      }}
    >
      Annulla
    </Button>
  );
};
