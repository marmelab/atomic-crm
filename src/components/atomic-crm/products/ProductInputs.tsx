import { required } from "ra-core";
import { BooleanInput } from "@/components/admin/boolean-input";
import { NumberInput } from "@/components/admin/number-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";

import { PRODUCT_TYPE_CHOICES } from "./productUtils";

export const ProductInputs = () => (
  <div className="flex flex-col gap-4">
    <TextInput source="reference" validate={required()} helperText={false} />
    <TextInput source="name" validate={required()} helperText={false} />
    <SelectInput
      source="type"
      choices={PRODUCT_TYPE_CHOICES}
      helperText={false}
    />
    <NumberInput
      source="price"
      label="Prix catalogue (€)"
      step={0.01}
      helperText={false}
    />
    <TextInput source="description" multiline helperText={false} />
    <BooleanInput source="active" defaultValue={true} />
  </div>
);
