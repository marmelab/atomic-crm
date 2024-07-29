import { supabaseAuthProvider } from 'ra-supabase';
import { dataProvider } from './dataProvider';
import { supabase } from './supabase';
import { Sale } from './types';


export const USER_STORAGE_KEY = 'user';

export const authProvider = supabaseAuthProvider(supabase, {
    getIdentity: async user => {
        const { data, error } = await supabase
            .from('sales')
            .select('id, first_name, last_name, email')
            .match({ user_id: user.id })
            .single();

        if (!data || error) {
            throw new Error();
        }

        return {
            id: data.id,
            fullName: `${data.first_name} ${data.last_name}`,
        };
    },
    getPermissions: async () => {
        const userItem = localStorage.getItem(USER_STORAGE_KEY);
        const localUser = userItem ? (JSON.parse(userItem) as Sale) : null;
        if (!localUser) {
            return Promise.reject('user is not logged in');
        }

        // We fetch permissions from server to avoid local storage tampering
        const user = await dataProvider.getOne<Sale>('sales', {
            id: localUser.id,
        });

        return user.data?.administrator ? 'admin' : 'user';
    },
});
