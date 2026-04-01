import { type User } from "jsr:@supabase/supabase-js@2";
import { supabaseAdmin } from "./supabaseAdmin.ts";

/**
 * Get the sale associated to the provided user.
 */
export const getUserSale = async (user: User) => {
  const { data, error } = await supabaseAdmin
    .from("sales")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (error) {
    throw new Error(`getUserSale failed: ${error.message}`);
  }

  return data;
};
