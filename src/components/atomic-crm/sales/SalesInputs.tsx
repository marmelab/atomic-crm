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
        label="crm.sales.fields.first_name"
        validate={required()}
        helperText={false}
      />
      <TextInput
        source="last_name"
        label="crm.sales.fields.last_name"
        validate={required()}
        helperText={false}
      />
      <TextInput
        source="email"
        label="crm.sales.fields.email"
        validate={[required(), email()]}
        helperText={false}
      />
      <BooleanInput
        source="administrator"
        label="crm.sales.fields.admin"
        readOnly={record?.id === identity?.id}
        helperText={false}
      />
      <BooleanInput
        source="disabled"
        label="crm.sales.fields.disabled"
        readOnly={record?.id === identity?.id}
        helperText={false}
      />
    </div>
  );
}
