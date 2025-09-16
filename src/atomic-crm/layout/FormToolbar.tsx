import {
  CancelButton,
  DeleteButton,
  SaveButton,
  FormToolbar as KitFormToolbar,
} from "@/components/admin";

export const FormToolbar = () => (
  <KitFormToolbar className="flex md:flex flex-row justify-between gap-2">
    <DeleteButton />

    <div className="flex flex-row gap-2 justify-end">
      <CancelButton />
      <SaveButton />
    </div>
  </KitFormToolbar>
);
