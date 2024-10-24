import { supabaseAuthProvider } from 'ra-supabase';
import { AuthProvider } from 'react-admin';
import { supabase } from './supabase';
import { canAccess } from '../commons/canAccess';

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
});
// FIXME: Now that react-admin pessimistically calls getPermissions, it calls getPermissions when it initializes its routes
// However, getPermissions will currently fails if not signed in and that triggers a rerender of the signup page which clears
// all current inputs.
// The solution is to remove getPermissions from the authProvider as we now use canAccess.
delete baseAuthProvider.getPermissions;

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
        // Users are on the set-password page, nothing to do
        if (
            window.location.pathname === '/set-password' ||
            window.location.hash.includes('#/set-password')
        ) {
            return;
        }
        // Users are on the forgot-password page, nothing to do
        if (
            window.location.pathname === '/forgot-password' ||
            window.location.hash.includes('#/forgot-password')
        ) {
            return;
        }
        // Users are on the sign-up page, nothing to do
        if (
            window.location.pathname === '/sign-up' ||
            window.location.hash.includes('#/sign-up')
        ) {
            return;
        }

        const isInitialized = await getIsInitialized();

        if (!isInitialized) {
            await supabase.auth.signOut();
            // eslint-disable-next-line no-throw-literal
            throw {
                redirectTo: '/sign-up',
                message: false,
            };
        }

        return baseAuthProvider.checkAuth(params);
    },
    // FIXME: supabaseAuthProvider does not yet provide canAccess
    canAccess: async params => {
        const isInitialized = await getIsInitialized();
        if (!isInitialized) return false;

        // Get the current user
        const { data: dataSession, error: errorSession } =
            await supabase.auth.getSession();
        if (!dataSession.session?.user || errorSession) return false;

        // Get the matching sale
        const { data: dataSale, error: errorSale } = await supabase
            .from('sales')
            .select('administrator')
            .match({ user_id: dataSession.session.user.id })
            .single();
        if (!dataSale || errorSale) return false;

        // Compute access rights from the sale role
        const role = dataSale.administrator ? 'admin' : 'user';
        return canAccess(role, params);
    },
};
