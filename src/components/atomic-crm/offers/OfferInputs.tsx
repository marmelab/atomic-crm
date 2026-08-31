import { required } from "ra-core";
import { useFormContext, useWatch } from "react-hook-form";
import { BooleanInput } from "@/components/admin/boolean-input";
import { NumberInput } from "@/components/admin/number-input";
import { RadioButtonGroupInput } from "@/components/admin/radio-button-group-input";
import { TextInput } from "@/components/admin/text-input";

import { offerTypeLabels } from "./offerConstants";

const offerTypeChoices = [
  { id: "individual", name: offerTypeLabels.individual },
  { id: "group", name: offerTypeLabels.group },
];

// The "+ New Program" flow's Offer fields (§7 of the Programs + Opportunity
// UX slice): no unnecessary DB terminology, just what defines a program —
// name, how you work with clients, duration, price, and (for a 1:1 program
// only) a capacity ceiling.
export const OfferInputs = () => {
  const { control } = useFormContext();
  const type = useWatch({ control, name: "type" });

  return (
    <div className="flex flex-col gap-4">
      <TextInput source="name" validate={required()} helperText={false} />
      <RadioButtonGroupInput
        source="type"
        row
        choices={offerTypeChoices}
        validate={required()}
        helperText={false}
      />
      <TextInput
        source="duration"
        label="resources.offers.fields.duration"
        validate={required()}
        helperText={false}
      />
      <NumberInput
        source="current_price"
        label="resources.offers.fields.current_price"
        validate={required()}
        helperText={false}
      />
      {type === "individual" && (
        <NumberInput
          source="max_active_clients"
          label="resources.offers.fields.max_active_clients"
          helperText={false}
        />
      )}
      <BooleanInput
        source="is_active"
        label="resources.offers.fields.is_active"
        defaultValue={true}
        helperText={false}
      />
    </div>
  );
};
