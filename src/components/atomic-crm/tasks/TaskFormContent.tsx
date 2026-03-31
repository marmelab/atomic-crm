import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { DateInput } from "@/components/admin/date-input";
import { DateTimeInput } from "@/components/admin/date-time-input";
import { BooleanInput } from "@/components/admin/boolean-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";
import { required } from "ra-core";
import { useWatch } from "react-hook-form";

import { buildNameSearchFilter } from "../misc/referenceSearch";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { toBusinessISODate } from "@/lib/dateTimezone";

export const TaskFormContent = ({
  selectClient,
}: {
  selectClient?: boolean;
}) => {
  const { taskTypes } = useConfigurationContext();
  const allDay = useWatch({ name: "all_day" }) ?? true;

  return (
    <div className="flex flex-col gap-4">
      <TextInput
        autoFocus
        source="text"
        label="Descrizione"
        validate={required()}
        multiline
        className="m-0"
        helperText={false}
      />
      {selectClient && (
        <ReferenceInput source="client_id" reference="clients">
          <AutocompleteInput
            label="Cliente"
            optionText="name"
            helperText={false}
            filterToQuery={buildNameSearchFilter}
          />
        </ReferenceInput>
      )}

      <BooleanInput
        source="all_day"
        label="Tutto il giorno"
        defaultValue={true}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {allDay ? (
          <DateInput
            source="due_date"
            label="Scadenza"
            helperText={false}
            validate={required()}
            format={(value) =>
              value == null || value === ""
                ? null
                : toBusinessISODate(value as string | Date)
            }
          />
        ) : (
          <DateTimeInput
            source="due_date"
            label="Scadenza"
            helperText={false}
            validate={required()}
          />
        )}
        <SelectInput
          source="type"
          label="Tipo"
          validate={required()}
          choices={taskTypes}
          optionText="label"
          optionValue="value"
          helperText={false}
        />
      </div>
    </div>
  );
};
