 
import { HTMLAttributes } from "react";
import { RaRecord, useFieldValue, useTranslate } from "ra-core";
import { FieldProps } from "@/lib/field.type.ts";

export const NumberField = <RecordType extends RaRecord = RaRecord>({
  defaultValue,
  source,
  record,
  empty,
  resource: _,
  transform = defaultTransform,
  locales,
  options,
  ...rest
}: NumberFieldProps<RecordType>) => {
  let value = useFieldValue({ defaultValue, source, record });
  const translate = useTranslate();

  if (value == null) {
    return empty && typeof empty === "string"
      ? translate(empty, { _: empty })
      : empty;
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

export interface NumberFieldProps<RecordType extends RaRecord = RaRecord>
  extends FieldProps<RecordType>,
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
