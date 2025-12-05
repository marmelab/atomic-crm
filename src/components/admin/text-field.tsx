import type { HTMLAttributes } from "react";
import { useFieldValue, useTranslate } from "ra-core";
import type { FieldProps } from "@/lib/field.type";

/**
 * Displays a text value from a record field inside a span element.
 *
 * This is the default field component used in DataTable columns and RecordField components.
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/textfield/ TextField documentation}
 *
 * @example
 * import { List, DataTable, TextField } from '@/components/admin';
 *
 * export const UserList = () => (
 *   <List>
 *     <DataTable>
 *       <DataTable.Col source="id" />
 *       <DataTable.Col>
 *         <TextField source="name" empty="resources.users.fields.name.empty" />
 *       </DataTable.Col>
 *     </DataTable>
 *   </List>
 * );
 */
export const TextField = <
  RecordType extends Record<string, any> = Record<string, any>,
>({
  defaultValue,
  source,
  record,
  empty,
  ...rest
}: TextFieldProps<RecordType>) => {
  const value = useFieldValue({ defaultValue, source, record });
  const translate = useTranslate();

  if (value == null) {
    if (!empty) {
      return null;
    }

    return (
      <span {...rest}>
        {typeof empty === "string" ? translate(empty, { _: empty }) : empty}
      </span>
    );
  }

  return (
    <span {...rest}>
      {typeof value !== "string" ? value.toString() : value}
    </span>
  );
};

export interface TextFieldProps<
  RecordType extends Record<string, any> = Record<string, any>,
> extends FieldProps<RecordType>,
    HTMLAttributes<HTMLSpanElement> {}
