import { useContext, useState } from "react";
import { required, useRecordContext } from "ra-core";
import { useFormContext } from "react-hook-form";
import { AutocompleteArrayInput } from "@/components/admin/autocomplete-array-input";
import { ReferenceArrayInput } from "@/components/admin/reference-array-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { TextInput } from "@/components/admin/text-input";
import { NumberInput } from "@/components/admin/number-input";
import { DateInput } from "@/components/admin/date-input";
import { SelectInput } from "@/components/admin/select-input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";

import { contactOptionText } from "../misc/ContactOption";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { AutocompleteCompanyInput } from "../companies/AutocompleteCompanyInput.tsx";
import { DealListViewContext } from "./DealListContent";

export const DealInputs = () => {
  const isMobile = useIsMobile();
  const { companyType: contextCompanyType } = useContext(DealListViewContext);
  const record = useRecordContext();
  const [companyTypeFilter, setCompanyTypeFilter] = useState(
    record?.company_type ?? contextCompanyType ?? "",
  );

  return (
    <div className="flex flex-col gap-8">
      <DealInfoInputs />

      <div className={`flex gap-6 ${isMobile ? "flex-col" : "flex-row"}`}>
        <DealLinkedToInputs
          companyTypeFilter={companyTypeFilter}
          onCompanyTypeFilterChange={setCompanyTypeFilter}
        />
        <Separator orientation={isMobile ? "horizontal" : "vertical"} />
        <DealMiscInputs />
      </div>
    </div>
  );
};

const DealInfoInputs = () => {
  return (
    <div className="flex flex-col gap-4 flex-1">
      <TextInput
        source="name"
        label="Nom de l'opportunité"
        validate={required()}
        helperText={false}
      />
      <TextInput source="description" multiline rows={3} helperText={false} />
    </div>
  );
};

const ALL_TYPES = "__all__";

const DealLinkedToInputs = ({
  companyTypeFilter,
  onCompanyTypeFilterChange,
}: {
  companyTypeFilter: string;
  onCompanyTypeFilterChange: (type: string) => void;
}) => {
  const { companyTypes } = useConfigurationContext();
  const { setValue } = useFormContext();

  const handleTypeChange = (newType: string) => {
    const type = newType === ALL_TYPES ? "" : newType;
    onCompanyTypeFilterChange(type);
    setValue("company_id", null);
  };

  const companyFilter = companyTypeFilter ? { type: companyTypeFilter } : {};

  return (
    <div className="flex flex-col gap-4 flex-1">
      <h3 className="text-base font-medium">Lié à</h3>

      <div className="space-y-1">
        <label className="text-sm font-medium">Vue</label>
        <Select
          value={companyTypeFilter || ALL_TYPES}
          onValueChange={handleTypeChange}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_TYPES}>Toutes les vues</SelectItem>
            {companyTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ReferenceInput
        source="company_id"
        reference="companies"
        filter={companyFilter}
      >
        <AutocompleteCompanyInput
          validate={required()}
          defaultType={companyTypeFilter || undefined}
        />
      </ReferenceInput>

      <ReferenceArrayInput source="contact_ids" reference="contacts_summary">
        <AutocompleteArrayInput
          label="Contacts associés"
          optionText={contactOptionText}
          helperText={false}
        />
      </ReferenceArrayInput>
    </div>
  );
};

const DealMiscInputs = () => {
  const { dealStages, dealCategories } = useConfigurationContext();
  return (
    <div className="flex flex-col gap-4 flex-1">
      <h3 className="text-base font-medium">Divers</h3>

      <SelectInput
        source="category"
        label="Catégorie"
        choices={dealCategories}
        optionText="label"
        optionValue="value"
        helperText={false}
      />
      <NumberInput
        source="amount"
        defaultValue={0}
        helperText={false}
        validate={required()}
      />
      <DateInput
        validate={required()}
        source="expected_closing_date"
        helperText={false}
        defaultValue={new Date().toISOString().split("T")[0]}
      />
      <DateInput
        source="trial_start_date"
        label="Début du trial"
        helperText={false}
      />
      <SelectInput
        source="stage"
        choices={dealStages}
        optionText="label"
        optionValue="value"
        defaultValue="opportunity"
        helperText={false}
        validate={required()}
      />
    </div>
  );
};
