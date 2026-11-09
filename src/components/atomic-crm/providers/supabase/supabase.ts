import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { config } from "../../root/config";

let supabaseClient: SupabaseClient | null = null;

export const getSupabaseClient = () => {
  if (!supabaseClient) {
    supabaseClient = createClient(
      config.supabaseUrl!,
      config.supabasePublishableKey!,
    );
  }
  return supabaseClient;
};
