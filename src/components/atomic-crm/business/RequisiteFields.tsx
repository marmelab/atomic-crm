import { useTranslate } from "ra-core";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { findInvalidRequisites } from "./requisiteRules";
import type { RequisiteField, Requisites } from "./types";

interface RequisiteFieldsProps {
  fields: RequisiteField[];
  value: Requisites;
  onChange: (value: Requisites) => void;
  /** Mark required fields: a business must fill them, a counterparty may not */
  showRequired?: boolean;
}

/** One input per requisite of the country, checked as the user types. */
export const RequisiteFields = ({
  fields,
  value,
  onChange,
  showRequired = true,
}: RequisiteFieldsProps) => {
  const translate = useTranslate();
  const invalid = new Set(findInvalidRequisites(fields, value));
  const groups = new Set(
    fields.map((field) => field.required_group).filter(Boolean),
  );

  return (
    <div className="flex flex-col gap-4">
      {fields.map((field) => {
        const id = `requisite-${field.key}`;
        const isInvalid = invalid.has(field.key);
        return (
          <div key={field.key} className="flex flex-col gap-1.5">
            <Label htmlFor={id}>
              {translate(`crm.requisites.${field.key}`, { _: field.label })}
              {showRequired && field.required ? " *" : ""}
            </Label>
            <Input
              id={id}
              value={value[field.key] ?? ""}
              inputMode={field.validator === "iban" ? "text" : "numeric"}
              autoComplete="off"
              aria-invalid={isInvalid}
              aria-describedby={isInvalid ? `${id}-error` : undefined}
              onChange={(event) =>
                onChange({ ...value, [field.key]: event.target.value })
              }
            />
            {isInvalid ? (
              <p id={`${id}-error`} className="text-sm text-destructive">
                {translate("crm.requisites.invalid", {
                  _: "Check the number: the check digits do not match",
                })}
              </p>
            ) : null}
          </div>
        );
      })}
      {showRequired && groups.has("tax_id") ? (
        <p className="text-sm text-muted-foreground">
          {translate("crm.requisites.tax_id_hint", {
            _: "A company enters its EDRPOU code, a sole proprietor the individual tax number.",
          })}
        </p>
      ) : null}
    </div>
  );
};
