import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { DateInput } from "@/components/admin/date-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";
import { required, useTranslate } from "ra-core";

import { contactOptionText } from "../misc/ContactOption";
import { useConfigurationContext } from "../root/ConfigurationContext";

export const TaskFormContent = ({
  selectContact,
}: {
  selectContact?: boolean;
}) => {
  const { taskTypes } = useConfigurationContext();
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-4">
      <TextInput
        autoFocus
        source="text"
        label={translate("crm.tasks.fields.description", { _: "Description" })}
        validate={required()}
        multiline
        className="m-0"
        helperText={false}
      />
      {selectContact && (
        <ReferenceInput source="contact_id" reference="contacts_summary">
          <AutocompleteInput
            label={translate("crm.contacts.forcedCaseName", { _: "Contact" })}
            optionText={contactOptionText}
            helperText={false}
            validate={required()}
          />
        </ReferenceInput>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DateInput
          source="due_date"
          label="crm.tasks.fields.due_date"
          helperText={false}
          validate={required()}
        />
        <SelectInput
          source="type"
          label="crm.tasks.fields.type"
          validate={required()}
          choices={taskTypes}
          optionText="label"
          optionValue="value"
          defaultValue="none"
          helperText={false}
        />
      </div>
    </div>
  );
};
