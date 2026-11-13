import { supabaseAdmin } from "./supabaseAdmin.ts";

export const BUSINESS_ROLES = [
  "owner",
  "manager",
  "specialist",
  "storekeeper",
  "accountant",
  "partner",
] as const;

export type BusinessRole = (typeof BUSINESS_ROLES)[number];

export interface BusinessContext {
  business_id: string;
  role: BusinessRole;
}

export const isBusinessRole = (value: unknown): value is BusinessRole =>
  typeof value === "string" &&
  (BUSINESS_ROLES as readonly string[]).includes(value);

/**
 * The business a user currently works in and their role there, or null when
 * the user has no active membership. Mirrors public.current_business_id(),
 * which edge functions running with the service role cannot use.
 */
export const getBusinessContext = async (
  userId: string,
): Promise<BusinessContext | null> => {
  const { data, error } = await supabaseAdmin.rpc("business_context_for_user", {
    p_user_id: userId,
  });
  if (error) {
    throw error;
  }
  return (data as BusinessContext[] | null)?.[0] ?? null;
};
