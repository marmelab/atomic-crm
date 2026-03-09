import { email, required, useGetIdentity, useRecordContext } from "ra-core";
import { BooleanInput } from "@/components/admin/boolean-input";
import { TextInput } from "@/components/admin/text-input";

import type { Sale } from "../types";

export function SalesInputs() {
  const { identity } = useGetIdentity();
  const record = useRecordContext<Sale>();
  return (
    <div className="space-y-4 w-full">
      <TextInput source="first_name" label="Prénom" validate={required()} helperText={false} />
      <TextInput source="last_name" label="Nom" validate={required()} helperText={false} />
      <TextInput
        source="email"
        label="Email"
        validate={[required(), email()]}
        helperText={false}
      />
      <BooleanInput
        source="administrator"
        label="Administrateur"
        readOnly={record?.id === identity?.id}
        helperText={false}
      />
      <BooleanInput
        source="disabled"
        label="Désactivé"
        readOnly={record?.id === identity?.id}
        helperText={false}
      />
    </div>
  );
}
