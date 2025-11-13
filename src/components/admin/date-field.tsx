import type { HTMLAttributes } from "react";
import { useFieldValue, useTranslate } from "ra-core";

import { genericMemo } from "@/lib/genericMemo";
import type { FieldProps } from "@/lib/field.type";

/**
 * Display a date value as a locale string.
 *
 * Uses Intl.DateTimeFormat() if available, passing the locales and options props as arguments.
 * If Intl is not available, it outputs date as is (and ignores the locales and options props).
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toLocaleString
 * @example
 * <DateField source="published_at" />
 * // renders the record { id: 1234, published_at: new Date('2012-11-07') } as
 * <span>07/11/2012</span>
 *
 * <DateField source="published_at" className="red" />
 * // renders the record { id: 1234, new Date('2012-11-07') } as
 * <span class="red">07/11/2012</span>
 *
 * <DateField source="share" options={{ weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }} />
 * // renders the record { id: 1234, new Date('2012-11-07') } as
 * <span>Wednesday, November 7, 2012</span>
 *
 * <DateField source="price" locales="fr-FR" options={{ weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }} />
 * // renders the record { id: 1234, new Date('2012-11-07') } as
 * <span>mercredi 7 novembre 2012</span>
 */
const DateFieldImpl = <
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RecordType extends Record<string, any> = Record<string, any>,
>(
  inProps: DateFieldProps<RecordType>,
) => {
  const {
    empty,
    locales,
    options,
    showTime = false,
    showDate = true,
    transform = defaultTransform,
    source,
    record,
    defaultValue,
    ...rest
  } = inProps;
  const translate = useTranslate();

  if (!showTime && !showDate) {
    throw new Error(
      "<DateField> cannot have showTime and showDate false at the same time",
    );
  }

  const value = useFieldValue({ source, record, defaultValue });
  if (value == null || value === "") {
    if (!empty) {
      return null;
    }

    return (
      <span {...rest}>
        {typeof empty === "string" ? translate(empty, { _: empty }) : empty}
      </span>
    );
  }

  const date = transform(value);

  let dateString = "";
  if (date) {
    if (showTime && showDate) {
      dateString = toLocaleStringSupportsLocales
        ? date.toLocaleString(locales, options)
        : date.toLocaleString();
    } else if (showDate) {
      // If input is a date string (e.g. '2022-02-15') without time and time zone,
      // force timezone to UTC to fix issue with people in negative time zones
      // who may see a different date when calling toLocaleDateString().
      const dateOptions =
        options ??
        (typeof value === "string" && value.length <= 10
          ? { timeZone: "UTC" }
          : undefined);
      dateString = toLocaleStringSupportsLocales
        ? date.toLocaleDateString(locales, dateOptions)
        : date.toLocaleDateString();
    } else if (showTime) {
      dateString = toLocaleStringSupportsLocales
        ? date.toLocaleTimeString(locales, options)
        : date.toLocaleTimeString();
    }
  }

  return <span {...rest}>{dateString}</span>;
};
DateFieldImpl.displayName = "DateFieldImpl";

export const DateField = genericMemo(DateFieldImpl);

export interface DateFieldProps<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RecordType extends Record<string, any> = Record<string, any>,
> extends FieldProps<RecordType>,
    HTMLAttributes<HTMLSpanElement> {
  locales?: Intl.LocalesArgument;
  options?: Intl.DateTimeFormatOptions;
  showTime?: boolean;
  showDate?: boolean;
  transform?: (value: unknown) => Date;
}

const defaultTransform = (value: unknown) =>
  value instanceof Date
    ? value
    : typeof value === "string" || typeof value === "number"
      ? new Date(value)
      : undefined;

const toLocaleStringSupportsLocales = (() => {
  // from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toLocaleString
  try {
    new Date().toLocaleString("i");
  } catch (error) {
    return error instanceof RangeError;
  }
  return false;
})();
