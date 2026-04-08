import { useGetIdentity, useTranslate } from "ra-core";
import { CreateSheet } from "../misc/CreateSheet";
import { DealInputs } from "./DealInputs";

export interface DealCreateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DealCreateSheet = ({
  open,
  onOpenChange,
}: DealCreateSheetProps) => {
  const { identity } = useGetIdentity();
  const translate = useTranslate();
  return (
    <CreateSheet
      resource="deals"
      title={translate("resources.deals.action.new", {
        _: "New Lead",
      })}
      redirect={false}
      defaultValues={{
        sales_id: identity?.id,
        stage: "lead",
        amount: 0,
        contact_ids: [],
        index: 0,
        expected_closing_date: new Date().toISOString().split("T")[0],
      }}
      open={open}
      onOpenChange={onOpenChange}
    >
      <DealInputs />
    </CreateSheet>
  );
};
