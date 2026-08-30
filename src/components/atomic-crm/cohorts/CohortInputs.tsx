import { required } from "ra-core";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { DateInput } from "@/components/admin/date-input";
import { NumberInput } from "@/components/admin/number-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";

import { cohortStatuses } from "./cohortConstants";

// Cohorts only ever belong to a GROUP offer (enforced server-side by
// cohorts_offer_id_fkey + the offer picker filter below).
export const CohortInputs = () => (
  <div className="flex flex-col gap-4">
    <ReferenceInput
      source="offer_id"
      reference="offers"
      filter={{ type: "group" }}
    >
      <AutocompleteInput
        label="resources.cohorts.fields.offer_id"
        optionText="name"
        helperText={false}
        validate={required()}
      />
    </ReferenceInput>
    <TextInput source="name" validate={required()} helperText={false} />
    <SelectInput
      source="status"
      choices={cohortStatuses}
      optionText="label"
      optionValue="value"
      defaultValue="draft"
      helperText={false}
      validate={required()}
    />
    <div className="flex flex-col sm:flex-row gap-4">
      <DateInput
        source="applications_open_at"
        label="resources.cohorts.fields.applications_open_at"
        helperText={false}
      />
      <DateInput
        source="applications_close_at"
        label="resources.cohorts.fields.applications_close_at"
        helperText={false}
      />
    </div>
    <div className="flex flex-col sm:flex-row gap-4">
      <DateInput
        source="program_start_at"
        label="resources.cohorts.fields.program_start_at"
        helperText={false}
      />
      <DateInput
        source="program_end_at"
        label="resources.cohorts.fields.program_end_at"
        helperText={false}
      />
    </div>
    <div className="flex flex-col sm:flex-row gap-4">
      <NumberInput
        source="minimum_capacity"
        label="resources.cohorts.fields.minimum_capacity"
        helperText={false}
      />
      <NumberInput
        source="target_capacity"
        label="resources.cohorts.fields.target_capacity"
        helperText={false}
      />
      <NumberInput
        source="maximum_capacity"
        label="resources.cohorts.fields.maximum_capacity"
        helperText={false}
      />
    </div>
  </div>
);
