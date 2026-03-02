import { useMutation } from "@tanstack/react-query";
import {
  useDataProvider,
  useEditController,
  useNotify,
  useRecordContext,
  useRedirect,
  useTranslate,
} from "ra-core";
import type { SubmitHandler } from "react-hook-form";
import { SimpleForm } from "@/components/admin/simple-form";
import { CancelButton } from "@/components/admin/cancel-button";
import { SaveButton } from "@/components/admin/form";
import { Card, CardContent } from "@/components/ui/card";

import type { CrmDataProvider } from "../providers/types";
import type { Sale, SalesFormData } from "../types";
import { SalesInputs } from "./SalesInputs";

function EditToolbar() {
  return (
    <div className="flex justify-end gap-4">
      <CancelButton />
      <SaveButton />
    </div>
  );
}

export function SalesEdit() {
  const { record } = useEditController();

  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const redirect = useRedirect();
  const translate = useTranslate();

  const { mutate } = useMutation({
    mutationKey: ["signup"],
    mutationFn: async (data: SalesFormData) => {
      if (!record) {
        throw new Error(
          translate("crm.sales.edit.record_not_found", {
            _: "Record not found",
          }),
        );
      }
      return dataProvider.salesUpdate(record.id, data);
    },
    onSuccess: () => {
      redirect("/sales");
      notify("crm.sales.edit.success", {
        messageArgs: {
          _: "User updated successfully",
        },
      });
    },
    onError: () => {
      notify("crm.sales.edit.error", {
        type: "error",
        messageArgs: {
          _: "An error occurred. Please try again.",
        },
      });
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
            toolbar={<EditToolbar />}
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
  const translate = useTranslate();
  if (!record) return null;
  return (
    <h2 className="text-lg font-semibold mb-4">
      {translate("crm.sales.edit.title", {
        name: `${record.first_name} ${record.last_name}`,
        _: `Edit ${record.first_name} ${record.last_name}`,
      })}
    </h2>
  );
};
