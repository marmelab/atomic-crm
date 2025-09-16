import { useTranslate } from "ra-core";
import type { ReactNode } from "react";
import { isValidElement } from "react";
import { FormDescription } from "@/components/admin/form";

export function InputHelperText({ helperText }: { helperText?: ReactNode }) {
  const translate = useTranslate();

  if (!helperText) {
    return null;
  }

  if (isValidElement(helperText)) {
    return helperText;
  }

  return (
    <FormDescription>
      {typeof helperText === "string"
        ? translate(helperText, { _: helperText })
        : helperText}
    </FormDescription>
  );
}
