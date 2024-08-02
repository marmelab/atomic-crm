import { supabaseAuthProvider } from 'ra-supabase';
import { supabase } from './supabase';

export const USER_STORAGE_KEY = 'user';

export const authProvider = supabaseAuthProvider(supabase, {
    getIdentity: async user => {
        const { data, error } = await supabase
            .from('sales')
            .select('id, first_name, last_name, avatar')
            .match({ user_id: user.id })
            .single();

        if (!data || error) {
            throw new Error();
        }

        return {
            id: data.id,
            fullName: `${data.first_name} ${data.last_name}`,
            avatar: data.avatar?.src,
        };
    },
    getPermissions: async user => {
        const { data, error } = await supabase
            .from('sales')
            .select('administrator')
            .match({ user_id: user.id })
            .single();

        if (!data || error) {
            throw new Error();
        }

        return data?.administrator ? 'admin' : 'user';
    },
});
