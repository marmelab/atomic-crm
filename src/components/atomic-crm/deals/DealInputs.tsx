import { required, useTranslate } from "ra-core";
import { useWatch } from "react-hook-form";
import { ArrayInput } from "@/components/admin/array-input";
import { AutocompleteArrayInput } from "@/components/admin/autocomplete-array-input";
import { ReferenceArrayInput } from "@/components/admin/reference-array-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { TextInput } from "@/components/admin/text-input";
import { NumberInput } from "@/components/admin/number-input";
import { DateInput } from "@/components/admin/date-input";
import { SelectInput } from "@/components/admin/select-input";
import { SimpleFormIterator } from "@/components/admin/simple-form-iterator";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";

import { contactOptionText } from "../misc/ContactOption";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { AutocompleteCompanyInput } from "../companies/AutocompleteCompanyInput.tsx";
import { getDealAmount } from "./dealUtils";

export const DealInputs = () => {
  const isMobile = useIsMobile();
  return (
    <div className="flex flex-col gap-8">
      <DealInfoInputs />

      <div className={`flex gap-6 ${isMobile ? "flex-col" : "flex-row"}`}>
        <DealLinkedToInputs />
        <Separator orientation={isMobile ? "horizontal" : "vertical"} />
        <DealMiscInputs />
      </div>
    </div>
  );
};

const DealInfoInputs = () => {
  return (
    <div className="flex flex-col gap-4 flex-1">
      <TextInput source="name" validate={required()} helperText={false} />
      <TextInput source="description" multiline rows={3} helperText={false} />
    </div>
  );
};

const DealLinkedToInputs = () => {
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-4 flex-1">
      <h3 className="text-base font-medium">
        {translate("resources.deals.inputs.linked_to")}
      </h3>
      <ReferenceInput source="company_id" reference="companies">
        <AutocompleteCompanyInput
          label="resources.deals.fields.company_id"
          validate={required()}
          modal
        />
      </ReferenceInput>

      <ReferenceArrayInput source="contact_ids" reference="contacts_summary">
        <AutocompleteArrayInput
          label="resources.deals.fields.contact_ids"
          optionText={contactOptionText}
          helperText={false}
        />
      </ReferenceArrayInput>
    </div>
  );
};

const DealMiscInputs = () => {
  const { dealStages } = useConfigurationContext();
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-4 flex-1">
      <h3 className="text-base font-medium">
        {translate("resources.deals.field_categories.misc")}
      </h3>

      <DealCategoryAmountsInput />
      <DateInput
        validate={required()}
        source="expected_closing_date"
        helperText={false}
        defaultValue={new Date().toISOString().split("T")[0]}
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

/** One category + amount line per item of the deal; the deal amount is their sum */
const DealCategoryAmountsInput = () => {
  const { dealCategories, currency } = useConfigurationContext();
  const translate = useTranslate();
  const categoryAmounts = useWatch({ name: "category_amounts" });
  const amount = getDealAmount(categoryAmounts);
  return (
    <div className="flex flex-col gap-2">
      <ArrayInput
        source="category_amounts"
        label="resources.deals.fields.category_amounts"
        defaultValue={[{ category: null, amount: 0 }]}
        helperText={false}
      >
        <SimpleFormIterator inline disableReordering disableClear>
          <SelectInput
            source="category"
            label="resources.deals.fields.category"
            choices={dealCategories}
            optionText="label"
            optionValue="value"
            helperText={false}
          />
          <NumberInput
            source="amount"
            label="resources.deals.fields.amount"
            defaultValue={0}
            validate={required()}
            helperText={false}
          />
        </SimpleFormIterator>
      </ArrayInput>
      <p className="text-sm text-muted-foreground">
        {translate("resources.deals.fields.amount")}:{" "}
        <span className="text-foreground font-medium">
          {amount.toLocaleString("en-US", {
            style: "currency",
            currency,
            currencyDisplay: "narrowSymbol",
          })}
        </span>
      </p>
    </div>
  );
};
