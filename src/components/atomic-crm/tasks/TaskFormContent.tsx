import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";
import { required } from "ra-core";
import { DateInput } from "@/components/admin";

import { contactOptionText } from "../misc/ContactOption";
import { dateOnlyToTimestamp } from "../misc/dateOnlyToTimestamp";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { taskStatuses } from "./taskConstants";

export const TaskFormContent = ({
  selectContact,
}: {
  selectContact?: boolean;
}) => {
  const { taskTypes } = useConfigurationContext();
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
        {/* Manual Task UX repair, round 2 (§4): date only, no time-of-day
            — Leif doesn't need clock-time precision for an ordinary
            Task, and the row display has already been date-only for a
            while (see Task.tsx's own due-date line). dateOnlyToTimestamp
            is the SAME shared "bare date -> safe timestamp" helper
            postponeTaskDate.ts/followUpTask.ts already use — anchors to
            local noon so due_date stays a real timestamp and
            Denver-local day bucketing (tasksPredicate.ts) stays
            correct, never reinventing that trick a third time. */}
        <DateInput
          source="due_date"
          parse={dateOnlyToTimestamp}
          helperText={false}
          validate={required()}
        />
        <SelectInput
          source="type"
          validate={required()}
          choices={taskTypes}
          optionText="label"
          optionValue="value"
          defaultValue="other"
          helperText={false}
        />
      </div>
      <SelectInput
        source="status"
        label="resources.tasks.fields.status"
        choices={taskStatuses}
        optionText="label"
        optionValue="value"
        defaultValue="pending"
        helperText={false}
      />
    </div>
  );
};
