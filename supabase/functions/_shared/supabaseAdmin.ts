import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { createClient } from "jsr:@supabase/supabase-js@2";

export const supabaseAdmin: SupabaseClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SB_SECRET_KEY") ?? "",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
