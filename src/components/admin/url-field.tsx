import { useFieldValue, useTranslate } from "ra-core";
import type { AnchorHTMLAttributes } from "react";
import * as React from "react";

import { cn } from "@/lib/utils";
import { genericMemo } from "@/lib/genericMemo";
import { FieldProps } from "@/lib/field.type";

const UrlFieldImpl = <
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  RecordType extends Record<string, any> = Record<string, any>,
>(
  inProps: UrlFieldProps<RecordType>,
) => {
  const {
    empty,
    className,
    defaultValue,
    source,
    record,
    resource: _,
    ...rest
  } = inProps;
  const value = useFieldValue({ defaultValue, source, record });
  const translate = useTranslate();

  if (value == null) {
    if (!empty) {
      return null;
    }

    return (
      <span className={className} {...rest}>
        {typeof empty === "string" ? translate(empty, { _: empty }) : empty}
      </span>
    );
  }

  return (
    <a
      className={cn("underline hover:no-underline", className)}
      href={value}
      onClick={stopPropagation}
      {...rest}
    >
      {value}
    </a>
  );
};
UrlFieldImpl.displayName = "UrlFieldImpl";

export const UrlField = genericMemo(UrlFieldImpl);

export interface UrlFieldProps<
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  RecordType extends Record<string, any> = Record<string, any>,
> extends FieldProps<RecordType>,
    AnchorHTMLAttributes<HTMLAnchorElement> {}

// useful to prevent click bubbling in a DataTable with rowClick
const stopPropagation = (e: React.MouseEvent<HTMLAnchorElement>) =>
  e.stopPropagation();
