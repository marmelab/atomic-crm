import { isValidRequisite } from "../requisites/validators";
import type { RequisiteField, Requisites } from "./types";

/** Requisite keys that are filled with an invalid value. */
export const findInvalidRequisites = (
  fields: RequisiteField[],
  requisites: Requisites,
): string[] =>
  fields
    .filter((field) => {
      const value = requisites[field.key]?.trim();
      return value ? !isValidRequisite(field.validator, value) : false;
    })
    .map((field) => field.key);

/**
 * What still has to be filled: required fields, and groups (one of the fields
 * is enough). Same rule as public.missing_requisites().
 */
export const findMissingRequisites = (
  fields: RequisiteField[],
  requisites: Requisites,
): string[] => {
  const isEmpty = (key: string) => !requisites[key]?.trim();
  const missing = fields
    .filter((field) => field.required && isEmpty(field.key))
    .map((field) => field.key);
  const groups = new Set(
    fields.map((field) => field.required_group).filter(Boolean) as string[],
  );
  for (const group of groups) {
    const groupFields = fields.filter((f) => f.required_group === group);
    if (groupFields.every((field) => isEmpty(field.key))) missing.push(group);
  }
  return missing;
};

/** Drops empty values before saving. */
export const compactRequisites = (requisites: Requisites): Requisites =>
  Object.fromEntries(
    Object.entries(requisites)
      .map(([key, value]) => [key, value.trim()])
      .filter(([, value]) => value !== ""),
  );
