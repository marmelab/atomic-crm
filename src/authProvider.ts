import { supabaseAuthProvider } from 'ra-supabase';
import { AuthProvider } from 'react-admin';
import { supabase } from './supabase';

export const USER_STORAGE_KEY = 'user';

const baseAuthProvider = supabaseAuthProvider(supabase, {
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
            return null;
        }

        return data?.administrator ? 'admin' : 'user';
    },
});

export async function getIsInitialized() {
    const { data } = await supabase.from('init_state').select('is_initialized');

    return data?.at(0)?.is_initialized > 0;
}

export const authProvider: AuthProvider = {
    ...baseAuthProvider,
    checkAuth: async params => {
        const isInitialized = await getIsInitialized();

        if (!isInitialized) {
            // eslint-disable-next-line no-throw-literal
            throw {
                redirectTo: '/sign-up',
                message: false,
            };
        }

        return baseAuthProvider.checkAuth(params);
    },
};
