import { type User } from "jsr:@supabase/supabase-js@2";
import { supabaseAdmin } from "./supabaseAdmin.ts";

/**
 * Get the sale associated to the provided user.
 */
export const getUserSale = async (user: User) => {
  return (
    await supabaseAdmin
      .from("sales")
      .select("*")
      .eq("user_id", user.id)
      .single()
  )?.data;
};
