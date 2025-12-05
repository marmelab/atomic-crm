import type { HTMLAttributes } from "react";
import { useFieldValue, useTranslate } from "ra-core";
import type { FieldProps } from "@/lib/field.type";

/**
 * Displays a numeric value with locale-specific formatting.
 *
 * This field automatically formats numbers according to the user's locale using Intl.NumberFormat.
 * It supports custom locales and formatting options for currencies, percentages, and more.
 * To be used with RecordField or DataTable.Col components, or anywhere a RecordContext is available.
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/numberfield/ NumberField documentation}
 *
 * @example
 * import { Show, RecordField, NumberField } from '@/components/admin';
 *
 * const ProductShow = () => (
 *   <Show>
 *     <div className="flex flex-col gap-4">
 *       <RecordField source="reference" />
 *       <RecordField source="price">
 *         <NumberField source="price" options={{ style: 'currency', currency: 'USD' }} />
 *       </RecordField>
 *     </div>
 *   </Show>
 * );
 */
export const NumberField = <
  RecordType extends Record<string, any> = Record<string, any>,
>({
  defaultValue,
  source,
  record,
  empty,
  transform = defaultTransform,
  locales,
  options,
  ...rest
}: NumberFieldProps<RecordType>) => {
  let value = useFieldValue({ defaultValue, source, record });
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

  if (transform) {
    value = transform(value);
  }

  return (
    <span {...rest}>
      {hasNumberFormat && typeof value === "number"
        ? value.toLocaleString(locales, options)
        : value}
    </span>
  );
};

export interface NumberFieldProps<
  RecordType extends Record<string, any> = Record<string, any>,
> extends FieldProps<RecordType>,
    HTMLAttributes<HTMLSpanElement> {
  locales?: string | string[];
  options?: object;
  transform?: (value: any) => number;
}

const defaultTransform = (value: any) =>
  value && typeof value === "string" && !isNaN(value as any) ? +value : value;

const hasNumberFormat = !!(
  typeof Intl === "object" &&
  Intl &&
  typeof Intl.NumberFormat === "function"
);
