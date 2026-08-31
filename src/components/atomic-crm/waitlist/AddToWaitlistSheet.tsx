import type { Identifier } from "ra-core";
import { useTranslate } from "ra-core";
import { TextInput } from "@/components/admin/text-input";
import { SelectInput } from "@/components/admin/select-input";

import { CreateSheet } from "../misc/CreateSheet";
import { opportunitySources } from "../deals/opportunityConstants";
import { WaitlistPersonInput } from "./WaitlistPersonInput";

// "+ Add to Waitlist" (Waitlists slice, §9). Offer is always implied by the
// hosting page; Cohort is implied too when opened from a Cohort page
// (cohortId: <id>) — never asked again here. Only desired timing/notes/
// source are optional extras; nothing meaningless is required.
export const AddToWaitlistSheet = ({
  open,
  onOpenChange,
  offerId,
  cohortId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offerId: Identifier;
  cohortId: Identifier | null;
}) => {
  const translate = useTranslate();

  return (
    <CreateSheet
      resource="waitlist_entries"
      title={translate("resources.waitlist_entries.sheet.add", {
        _: "Add to Waitlist",
      })}
      redirect={false}
      open={open}
      onOpenChange={onOpenChange}
      defaultValues={{
        offer_id: offerId,
        cohort_id: cohortId,
        status: "waiting",
        joined_at: new Date().toISOString(),
      }}
    >
      <div className="flex flex-col gap-4">
        <WaitlistPersonInput offerId={offerId} cohortId={cohortId} />
        <TextInput
          source="desired_timing"
          label={translate("resources.waitlist_entries.fields.desired_timing", {
            _: "Desired timing",
          })}
          helperText={false}
        />
        <TextInput
          source="notes"
          label={translate("resources.waitlist_entries.fields.notes", {
            _: "Notes",
          })}
          multiline
          helperText={false}
        />
        <SelectInput
          source="source"
          label={translate("resources.waitlist_entries.fields.source", {
            _: "Source",
          })}
          choices={opportunitySources}
          optionText="label"
          optionValue="value"
          helperText={false}
          emptyText="resources.deals.source_none"
        />
      </div>
    </CreateSheet>
  );
};
