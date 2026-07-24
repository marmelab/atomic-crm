import * as React from "react";
import type { RaRecord } from "ra-core";
import { useFieldValue, useTranslate } from "ra-core";
import { Badge } from "@/components/ui/badge";
import type { FieldProps } from "@/lib/field.type";

type BadgeProps = React.ComponentProps<typeof Badge>;

/**
 * Displays a text value inside a styled badge component.
 *
 * This field wraps values in a Badge UI component with customizable variants (default, outline, secondary, destructive).
 * Use it to highlight status values, tags, or categorical information.
 * To be used with RecordField or DataTable.Col components, or anywhere a RecordContext is available.
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/badgefield/ BadgeField documentation}
 * @see {@link https://ui.shadcn.com/docs/components/badge Badge documentation}
 *
 * @example
 * import {
 *   List,
 *   DataTable,
 *   BadgeField,
 * } from '@/components/admin';
 *
 * const OrderList = () => (
 *   <List>
 *     <DataTable>
 *       <DataTable.Col source="id" />
 *       <DataTable.Col>
 *         <BadgeField source="status" variant="outline" />
 *       </DataTable.Col>
 *     </DataTable>
 *   </List>
 * );
 */
export const BadgeField = <RecordType extends RaRecord = RaRecord>({
  defaultValue,
  source,
  record,
  empty,
  variant = "outline",
  ...rest
}: BadgeFieldProps<RecordType>) => {
  const value = useFieldValue({ defaultValue, source, record });
  const translate = useTranslate();

  if (value == null) {
    return empty && typeof empty === "string"
      ? translate(empty, { _: empty })
      : empty;
  }

  return (
    <Badge variant={variant} {...rest}>
      {typeof value !== "string" ? value.toString() : value}
    </Badge>
  );
};

export interface BadgeFieldProps<RecordType extends RaRecord = RaRecord>
  extends FieldProps<RecordType>, BadgeProps {
  variant?: "default" | "outline" | "secondary" | "destructive";
}
