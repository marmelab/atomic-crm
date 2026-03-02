import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const sbSecretKey = Deno.env.get("SB_SECRET_KEY") ?? "";
const adminKey = supabaseServiceRoleKey || sbSecretKey;

if (!supabaseUrl || !adminKey) {
  throw new Error("Missing SUPABASE_URL or admin key");
}

export const supabaseAdmin: SupabaseClient = createClient(
  supabaseUrl,
  adminKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
