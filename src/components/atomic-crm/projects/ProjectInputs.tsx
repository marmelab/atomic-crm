import { required } from "ra-core";
import { useWatch } from "react-hook-form";
import { Separator } from "@/components/ui/separator";
import { TextInput } from "@/components/admin/text-input";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { SelectInput } from "@/components/admin/select-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { NumberInput } from "@/components/admin/number-input";
import { DateInput } from "@/components/admin/date-input";
import { DateTimeInput } from "@/components/admin/date-time-input";
import { BooleanInput } from "@/components/admin/boolean-input";

import { buildNameSearchFilter } from "../misc/referenceSearch";
import {
  projectCategoryChoices,
  projectTvShowChoices,
  projectStatusChoices,
} from "./projectTypes";

export const ProjectInputs = () => {
  return (
    <div className="flex flex-col gap-2 p-1">
      <div className="flex gap-6 flex-col md:flex-row">
        <div className="flex flex-col gap-10 flex-1">
          <ProjectIdentityInputs />
          <ProjectClassificationInputs />
        </div>
        <Separator
          orientation="vertical"
          className="flex-shrink-0 hidden md:block"
        />
        <div className="flex flex-col gap-10 flex-1">
          <ProjectDateBudgetInputs />
        </div>
      </div>
    </div>
  );
};

const ProjectIdentityInputs = () => (
  <div className="flex flex-col gap-4">
    <h6 className="text-lg font-semibold">Progetto</h6>
    <TextInput
      source="name"
      label="Nome progetto"
      validate={required()}
      helperText={false}
    />
    <ReferenceInput source="client_id" reference="clients">
      <AutocompleteInput
        label="Cliente"
        optionText="name"
        validate={required()}
        helperText={false}
        filterToQuery={buildNameSearchFilter}
      />
    </ReferenceInput>
  </div>
);

const ProjectClassificationInputs = () => {
  const category = useWatch({ name: "category" });

  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">Classificazione</h6>
      <SelectInput
        source="category"
        label="Categoria"
        choices={projectCategoryChoices}
        validate={required()}
        helperText={false}
      />
      {category === "produzione_tv" && (
        <SelectInput
          source="tv_show"
          label="Programma TV"
          choices={projectTvShowChoices}
          helperText={false}
        />
      )}
    </div>
  );
};

const ProjectDateBudgetInputs = () => {
  const allDay = useWatch({ name: "all_day" }) ?? true;
  const DateComponent = allDay ? DateInput : DateTimeInput;

  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">Date e budget</h6>
      <SelectInput
        source="status"
        label="Stato"
        choices={projectStatusChoices}
        defaultValue="in_corso"
        helperText={false}
      />
      <BooleanInput
        source="all_day"
        label="Tutto il giorno"
        defaultValue={true}
      />
      <DateComponent
        source="start_date"
        label="Data inizio"
        helperText={false}
      />
      <DateComponent
        source="end_date"
        label="Data fine prevista"
        validate={(value: string, allValues: Record<string, unknown>) => {
          if (
            value &&
            allValues.start_date &&
            value < (allValues.start_date as string)
          ) {
            return "La data fine non può essere prima della data inizio";
          }
        }}
        helperText={false}
      />
      <NumberInput
        source="budget"
        label="Budget concordato (EUR)"
        helperText={false}
      />
      <TextInput source="notes" label="Note" multiline helperText={false} />
    </div>
  );
};
