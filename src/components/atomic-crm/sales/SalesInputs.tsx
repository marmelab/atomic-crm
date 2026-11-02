import {
  email,
  required,
  useGetIdentity,
  useRecordContext,
  useTranslate,
} from "ra-core";
import { BooleanInput } from "@/components/admin/boolean-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";

import { resolveRole } from "../providers/commons/canAccess";
import type { Sale, SalesRole } from "../types";

export const SALES_ROLES: SalesRole[] = ["admin", "manager", "bde"];

export function SalesInputs() {
  const { identity } = useGetIdentity();
  const record = useRecordContext<Sale>();
  const translate = useTranslate();
  const isSelf = record?.id === identity?.id;
  return (
    <div className="space-y-4 w-full">
      <TextInput source="first_name" validate={required()} helperText={false} />
      <TextInput source="last_name" validate={required()} helperText={false} />
      <TextInput
        source="email"
        validate={[required(), email()]}
        helperText={false}
      />
      <SelectInput
        source="role"
        // records created before roles existed only carry the admin flag
        format={(value?: SalesRole) =>
          value ?? (record ? resolveRole(record) : "bde")
        }
        defaultValue="bde"
        choices={SALES_ROLES.map((role) => ({
          id: role,
          name: translate(`resources.sales.roles.${role}`),
        }))}
        validate={required()}
        readOnly={isSelf}
        helperText={translate("resources.sales.roles.help")}
      />
      <BooleanInput source="disabled" readOnly={isSelf} helperText={false} />
    </div>
  );
}
