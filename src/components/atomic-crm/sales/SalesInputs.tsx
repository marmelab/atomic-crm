import { email, required, useGetIdentity, useRecordContext } from "ra-core";
import { BooleanInput } from "@/components/admin/boolean-input";
import { TextInput } from "@/components/admin/text-input";

import type { Sale } from "../types";

export function SalesInputs() {
  const { identity } = useGetIdentity();
  const record = useRecordContext<Sale>();
  return (
    <div className="space-y-4 w-full">
      <TextInput
        source="first_name"
        label="resources.sales.fields.first_name"
        validate={required()}
        helperText={false}
      />
      <TextInput
        source="last_name"
        label="resources.sales.fields.last_name"
        validate={required()}
        helperText={false}
      />
      <TextInput
        source="email"
        label="resources.sales.fields.email"
        validate={[required(), email()]}
        helperText={false}
      />
      <BooleanInput
        source="administrator"
        label="resources.sales.fields.administrator"
        readOnly={record?.id === identity?.id}
        helperText={false}
      />
      <BooleanInput
        source="disabled"
        label="resources.sales.fields.disabled"
        readOnly={record?.id === identity?.id}
        helperText={false}
      />
    </div>
  );
}
