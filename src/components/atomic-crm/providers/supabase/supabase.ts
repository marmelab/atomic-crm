import { createClient } from "@supabase/supabase-js";

import { buildSupabaseAuthStorageKey } from "./authStorageKey";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SB_PUBLISHABLE_KEY;

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      storageKey: buildSupabaseAuthStorageKey(supabaseUrl),
    },
  },
);
