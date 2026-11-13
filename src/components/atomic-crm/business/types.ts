import type { RequisiteValidator } from "../requisites/validators";

export const BUSINESS_TYPES = [
  "services",
  "retail",
  "production",
  "b2b",
] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const BUSINESS_ROLES = [
  "owner",
  "manager",
  "specialist",
  "storekeeper",
  "accountant",
  "partner",
] as const;
export type BusinessRole = (typeof BUSINESS_ROLES)[number];

export type Requisites = Record<string, string>;

export interface CountryPack {
  code: string;
  name: string;
  language: string;
  locale: string;
  currency: string;
  timezone: string;
}

export interface RequisiteField {
  key: string;
  validator: RequisiteValidator;
  label: string;
  required: boolean;
  required_group: string | null;
  sort_order: number;
}

export interface Business {
  id: string;
  name: string;
  country_code: string | null;
  business_type: BusinessType | null;
  requisites: Requisites;
  currency: string;
  timezone: string;
  is_demo: boolean;
}

export interface BusinessMember {
  user_id: string;
  role: BusinessRole;
  disabled: boolean;
  first_name: string;
  last_name: string;
  email: string;
  /** The member is the signed-in user */
  is_me: boolean;
}

export interface NewBusiness {
  name: string;
  country_code: string;
  business_type: BusinessType;
  requisites: Requisites;
}
