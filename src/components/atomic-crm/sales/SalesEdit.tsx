import { useMutation } from "@tanstack/react-query";
import {
  useDataProvider,
  useEditController,
  useGetIdentity,
  useNotify,
  useRecordContext,
  useRedirect,
} from "ra-core";
import type { SubmitHandler } from "react-hook-form";
import { SimpleForm } from "@/components/admin/simple-form";
import { CancelButton } from "@/components/admin/cancel-button";
import { SaveButton } from "@/components/admin/form";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import type { CrmDataProvider } from "../providers/types";
import type { Sale, SalesFormData } from "../types";
import { SalesInputs } from "./SalesInputs";

function DeleteUserButton({ recordId }: { recordId: any }) {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const redirect = useRedirect();
  const { identity } = useGetIdentity();

  // Don't show delete button for the currently logged-in user
  if (!recordId || identity?.id === recordId) return null;

  const handleDelete = async () => {
    if (
      !window.confirm(
        "Supprimer cet utilisateur ? Cette action est irréversible.",
      )
    )
      return;
    try {
      await dataProvider.salesDelete(recordId);
      notify("Utilisateur supprimé");
      redirect("/sales");
    } catch {
      notify("Erreur lors de la suppression", { type: "error" });
    }
  };

  return (
    <Button variant="destructive" type="button" onClick={handleDelete}>
      Supprimer
    </Button>
  );
}

function EditToolbar({ recordId }: { recordId?: any }) {
  return (
    <div className="flex justify-between gap-4">
      <DeleteUserButton recordId={recordId} />
      <div className="flex gap-4">
        <CancelButton />
        <SaveButton />
      </div>
    </div>
  );
}

export function SalesEdit() {
  const { record } = useEditController();

  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const redirect = useRedirect();

  const { mutate } = useMutation({
    mutationKey: ["signup"],
    mutationFn: async (data: SalesFormData) => {
      if (!record) {
        throw new Error("Record not found");
      }
      return dataProvider.salesUpdate(record.id, data);
    },
    onSuccess: () => {
      redirect("/sales");
      notify("Utilisateur mis à jour");
    },
    onError: () => {
      notify("Une erreur est survenue. Veuillez réessayer.");
    },
  });

  const onSubmit: SubmitHandler<SalesFormData> = async (data) => {
    mutate(data);
  };

  return (
    <div className="max-w-lg w-full mx-auto mt-8">
      <Card>
        <CardContent>
          <SimpleForm
            toolbar={<EditToolbar recordId={record?.id} />}
            onSubmit={onSubmit as SubmitHandler<any>}
            record={record}
          >
            <SaleEditTitle />
            <SalesInputs />
          </SimpleForm>
        </CardContent>
      </Card>
    </div>
  );
}

const SaleEditTitle = () => {
  const record = useRecordContext<Sale>();
  if (!record) return null;
  return (
    <h2 className="text-lg font-semibold mb-4">
      Modifier {record?.first_name} {record?.last_name}
    </h2>
  );
};
