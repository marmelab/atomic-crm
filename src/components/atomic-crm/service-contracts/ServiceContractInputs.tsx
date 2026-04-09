import { required } from "ra-core";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { DateInput } from "@/components/admin/date-input";
import { NumberInput } from "@/components/admin/number-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";

import { STATUS_CHOICES } from "./contractUtils";

export const ServiceContractInputs = () => (
  <div className="flex flex-col gap-4 p-1">
    <TextInput source="name" validate={required()} />
    <ReferenceInput source="company_id" reference="companies">
      <AutocompleteInput optionText="name" validate={required()} />
    </ReferenceInput>
    <DateInput source="start_date" validate={required()} />
    <DateInput source="renewal_date" validate={required()} />
    <NumberInput source="amount" step={0.01} label="Montant annuel (€)" />
    <SelectInput
      source="status"
      choices={STATUS_CHOICES}
      defaultValue="actif"
    />
    <TextInput source="notes" multiline />
  </div>
);
