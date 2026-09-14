import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";
import { required } from "ra-core";
import { useEffect, useRef } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { DateTimeInput } from "@/components/admin";

import { contactOptionText } from "../misc/ContactOption";
import { ChoiceInput } from "../misc/ChoiceInput";
import type { Sale } from "../types";

/**
 * Meeting modes that have no physical location, so the `location` input is
 * disabled for them. Matched against the labels seeded in `choices`.
 */
const REMOTE_MEETING_MODES = ["visioconférence", "téléphone"];

const saleOptionRenderer = (choice: Sale) =>
  `${choice.first_name} ${choice.last_name}`;

export const TaskFormContent = ({
  selectContact,
}: {
  selectContact?: boolean;
}) => {
  const { setValue } = useFormContext();
  const mode = useWatch({ name: "mode" });
  const isRemote = REMOTE_MEETING_MODES.includes(
    (mode ?? "").toLowerCase().trim(),
  );

  // Switching to a remote mode empties the location the user had typed.
  // Keyed on the mode changing, so merely opening an existing meeting does not
  // silently wipe a stored location.
  const previousMode = useRef(mode);
  useEffect(() => {
    if (mode === previousMode.current) return;
    previousMode.current = mode;
    if (isRemote) {
      setValue("location", "", { shouldDirty: true });
    }
  }, [mode, isRemote, setValue]);

  return (
    <div className="flex flex-col gap-4">
      <TextInput
        autoFocus
        source="text"
        validate={required()}
        multiline
        className="m-0"
        helperText={false}
      />
      {selectContact && (
        <ReferenceInput source="contact_id" reference="contacts_summary">
          <AutocompleteInput
            label="resources.tasks.fields.contact_id"
            optionText={contactOptionText}
            helperText={false}
            validate={required()}
            modal
          />
        </ReferenceInput>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DateTimeInput
          source="due_date"
          helperText={false}
          validate={required()}
        />
        <ChoiceInput source="type" category="rdv_type" validate={required()} />
        <ChoiceInput source="mode" category="rdv_mode" />
        <TextInput source="location" helperText={false} disabled={isRemote} />
      </div>

      <ReferenceInput
        reference="sales"
        source="sales_id"
        sort={{ field: "last_name", order: "ASC" }}
        filter={{ "disabled@neq": true }}
      >
        <SelectInput
          label="resources.tasks.fields.sales_id"
          helperText={false}
          optionText={saleOptionRenderer}
        />
      </ReferenceInput>
    </div>
  );
};
