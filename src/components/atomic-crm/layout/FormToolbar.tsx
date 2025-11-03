import { CancelButton } from "@/components/admin/cancel-button";
import { DeleteButton } from "@/components/admin/delete-button";
import { SaveButton } from "@/components/admin/form";
import { FormToolbar as KitFormToolbar } from "@/components/admin/simple-form";

export const FormToolbar = () => (
  <KitFormToolbar className="flex md:flex flex-row justify-between gap-2">
    <DeleteButton />

    <div className="flex flex-row gap-2 justify-end">
      <CancelButton />
      <SaveButton />
    </div>
  </KitFormToolbar>
);
