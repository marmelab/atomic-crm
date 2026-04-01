import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";

let supabaseClient: SupabaseClient | null = null;

export const getSupabaseClient = () => {
  if (!supabaseClient) {
    supabaseClient = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SB_PUBLISHABLE_KEY,
    );
  }
  return supabaseClient;
};

// Backward-compat alias used in our Google integration code
export const supabase = {
  get auth() {
    return getSupabaseClient().auth;
  },
  get storage() {
    return getSupabaseClient().storage;
  },
  get functions() {
    return getSupabaseClient().functions;
  },
  from: (...args: Parameters<SupabaseClient["from"]>) =>
    getSupabaseClient().from(...args),
};
