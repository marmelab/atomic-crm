import { createClient } from '@supabase/supabase-js';
import { Zero } from '@rocicorp/zero';
import { schema } from '../../schema.js';

export const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
);

const {
    data: { user },
} = await supabase.auth.getUser();
const userID = user?.id ?? 'anon';

export const z = new Zero({
    userID,
    auth: async () => {
        const {
            data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;
        return token;
    },
    server: import.meta.env.VITE_ZERO_CACHE_URL,
    schema,
    // This is often easier to develop with if you're frequently changing
    // the schema. Switch to 'idb' for local-persistence.
    kvStore: 'mem',
});
