import { useMemo } from "react";
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

  // Human-acceptance repair pass, §2 (root cause): ra-core's
  // useAugmentedForm re-derives its defaultValues via
  // JSON.stringify(defaultValues) and calls reset() whenever that string
  // changes — an inline `new Date().toISOString()` here produced a NEW
  // string on every re-render of this component, so the "contacts" query
  // invalidation that fires the instant the quick-create Contact is
  // created (WaitlistPersonInput's onCreate) re-rendered this sheet mid-
  // flow, reset the whole form back to defaultValues, and silently wiped
  // out the just-selected Person. Freezing joined_at for the sheet's
  // open lifecycle (only recomputed when it actually opens) keeps the
  // JSON.stringify output stable across incidental re-renders while it's
  // open, so no unrelated re-render can ever reset the form underneath
  // the user again.
  const joinedAt = useMemo(() => new Date().toISOString(), [open]);

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
        joined_at: joinedAt,
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
