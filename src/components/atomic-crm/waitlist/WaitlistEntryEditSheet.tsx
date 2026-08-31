import { useTranslate } from "ra-core";
import type { Identifier } from "ra-core";
import { TextInput } from "@/components/admin/text-input";
import { NumberInput } from "@/components/admin/number-input";

import { EditSheet } from "../misc/EditSheet";

// Edits the few fields Leif can actually change on an active Waitlist
// Entry (Waitlists slice, §11) — desired timing, notes, and the optional
// manual ordering hint. Status transitions have their own dedicated
// actions (WaitlistEntryActions.tsx), never this generic edit form.
export const WaitlistEntryEditSheet = ({
  open,
  onOpenChange,
  entryId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entryId: Identifier;
}) => {
  const translate = useTranslate();
  return (
    <EditSheet
      resource="waitlist_entries"
      id={entryId}
      title={translate("resources.waitlist_entries.sheet.edit", {
        _: "Edit waitlist entry",
      })}
      redirect={false}
      open={open}
      onOpenChange={onOpenChange}
    >
      <div className="flex flex-col gap-4">
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
        <NumberInput
          source="priority"
          label={translate("resources.waitlist_entries.fields.priority", {
            _: "Priority (lower = sooner; optional)",
          })}
          helperText={false}
        />
      </div>
    </EditSheet>
  );
};
