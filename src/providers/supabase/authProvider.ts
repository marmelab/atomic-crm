import { supabaseAuthProvider } from 'ra-supabase';
import { AuthProvider } from 'react-admin';
import { supabase } from './supabase';

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
    if (getIsInitialized._is_initialized_cache == null) {
        const { data } = await supabase
            .from('init_state')
            .select('is_initialized');

        getIsInitialized._is_initialized_cache =
            data?.at(0)?.is_initialized > 0;
    }

    return getIsInitialized._is_initialized_cache;
}

export namespace getIsInitialized {
    export var _is_initialized_cache: boolean | null = null;
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
    // We need to ovveride the getPermissions here to avoid the `ra-supabase` retries
    async getPermissions(params) {
        const isInitialized = await getIsInitialized();
        return isInitialized ? baseAuthProvider.getPermissions(params) : null;
    },
    handleCallback: async () => {
        const { access_token, refresh_token, type } = getUrlParams();
        // Users have reset their password or have just been invited and must set a new password
        if (type === 'recovery' || type === 'invite') {
            if (access_token && refresh_token) {
                return {
                    redirectTo: `/set-password?access_token=${access_token}&refresh_token=${refresh_token}&type=${type}`,
                };
            }

            if (process.env.NODE_ENV === 'development') {
                console.error(
                    'Missing access_token or refresh_token for an invite or recovery'
                );
            }
        }
    },
};

const getUrlParams = () => {
    const urlSearchParams = new URLSearchParams(window.location.search);
    const access_token = urlSearchParams.get('access_token');
    const refresh_token = urlSearchParams.get('refresh_token');
    const type = urlSearchParams.get('type');

    return { access_token, refresh_token, type };
};
