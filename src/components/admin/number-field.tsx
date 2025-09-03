import { HTMLAttributes } from "react";
import { useFieldValue, useTranslate } from "ra-core";
import { FieldProps } from "@/lib/field.type";

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
