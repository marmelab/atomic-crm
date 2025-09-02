import { useFieldValue, useTranslate } from "ra-core";
import React, { AnchorHTMLAttributes } from "react";

import { cn } from "@/lib/utils";
import { genericMemo } from "@/lib/genericMemo";
import { FieldProps } from "@/lib/field.type.ts";

const EmailFieldImpl = <
   
  RecordType extends Record<string, any> = Record<string, any>,
>(
  inProps: EmailFieldProps<RecordType>,
) => {
  const {
    className,
    empty,
    defaultValue,
    source,
    record,
    resource: _,
    ...rest
  } = inProps;
  const value = useFieldValue({ defaultValue, source, record });
  const translate = useTranslate();

  if (value == null) {
    return (
      <a className={className} {...rest}>
        {empty && typeof empty === "string"
          ? translate(empty, { _: empty })
          : empty}
      </a>
    );
  }

  return (
    <a
      className={cn("underline hover:no-underline", className)}
      href={`mailto:${value}`}
      onClick={stopPropagation}
      {...rest}
    >
      {value}
    </a>
  );
};
EmailFieldImpl.displayName = "EmailFieldImpl";

export const EmailField = genericMemo(EmailFieldImpl);

export interface EmailFieldProps<
   
  RecordType extends Record<string, any> = Record<string, any>,
> extends FieldProps<RecordType>,
    AnchorHTMLAttributes<HTMLAnchorElement> {}

// useful to prevent click bubbling in a DataTable with rowClick
const stopPropagation = (e: React.MouseEvent<HTMLAnchorElement>) =>
  e.stopPropagation();
