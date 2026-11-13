import { type User } from "jsr:@supabase/supabase-js@2";
import { supabaseAdmin } from "./supabaseAdmin.ts";

/**
 * Get the active sale associated to the provided user.
 * A disabled sale returns null: its JWT stays valid until it expires, and
 * supabaseAdmin bypasses RLS, so callers must not trust it.
 */
export const getUserSale = async (user: User) => {
  return (
    await supabaseAdmin
      .from("sales")
      .select("*")
      .eq("user_id", user.id)
      .eq("disabled", false)
      .single()
  )?.data;
};
