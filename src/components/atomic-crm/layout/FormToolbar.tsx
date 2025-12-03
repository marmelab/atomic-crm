import { CancelButton } from "@/components/admin/cancel-button";
import { SaveButton } from "@/components/admin/form";

export const FormToolbar = () => (
  <div
    role="toolbar"
    className="sticky flex pt-4 pb-4 md:pb-0 bottom-0 bg-linear-to-b from-transparent to-card to-10% flex-row justify-end gap-2"
  >
    <CancelButton />
    <SaveButton />
  </div>
);
