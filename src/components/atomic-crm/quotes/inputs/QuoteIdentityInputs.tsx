import { required } from "ra-core";
import { useWatch } from "react-hook-form";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { SelectInput } from "@/components/admin/select-input";
import { BooleanInput } from "@/components/admin/boolean-input";
import { DateInput } from "@/components/admin/date-input";
import { DateTimeInput } from "@/components/admin/date-time-input";
import { User } from "lucide-react";

import { buildNameSearchFilter } from "../../misc/referenceSearch";
import { useConfigurationContext } from "../../root/ConfigurationContext";

import { toOptionalIdentifier } from "../quoteProjectLinking";

export const QuoteIdentityInputs = () => {
  const clientId = useWatch({ name: "client_id" });
  const allDay = useWatch({ name: "all_day" }) ?? true;
  const { quoteServiceTypes } = useConfigurationContext();

  const DateComponent = allDay ? DateInput : DateTimeInput;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 mb-1">
        <User className="h-4 w-4 text-blue-500" />
        <h6 className="text-sm font-semibold text-blue-700">Identità</h6>
      </div>

      <ReferenceInput source="client_id" reference="clients">
        <AutocompleteInput
          label="Cliente"
          optionText="name"
          validate={required()}
          helperText={false}
          filterToQuery={buildNameSearchFilter}
        />
      </ReferenceInput>

      <ReferenceInput
        source="project_id"
        reference="projects"
        filter={clientId ? { "client_id@eq": String(clientId) } : undefined}
      >
        <AutocompleteInput
          label="Progetto collegato"
          optionText="name"
          helperText={false}
          placeholder="Nessun progetto collegato"
          parse={toOptionalIdentifier}
          filterToQuery={buildNameSearchFilter}
        />
      </ReferenceInput>

      <SelectInput
        source="service_type"
        label="Tipo servizio"
        choices={quoteServiceTypes}
        optionText="label"
        optionValue="value"
        validate={required()}
        helperText={false}
      />

      <BooleanInput
        source="all_day"
        label="Tutto il giorno"
        defaultValue={true}
      />
      <DateComponent
        source="event_start"
        label="Data inizio evento"
        helperText={false}
      />
      <DateComponent
        source="event_end"
        label="Data fine evento"
        validate={(value: string, allValues: Record<string, unknown>) => {
          if (
            value &&
            allValues.event_start &&
            value < (allValues.event_start as string)
          ) {
            return "La data fine non può essere prima della data inizio";
          }
        }}
        helperText={false}
      />
    </div>
  );
};
