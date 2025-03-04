import { useEffect } from 'react';
import { supabase, supabaseAdmin } from '../providers/supabase/supabase';

export const onAddUser = async (body: any) => {
    try {
        const { email, first_name, last_name, disabled, password } = body || {};
        console.log('body', body);

        const { data: existingProfile, error: fetchError } = await supabase
            .from('profiles')
            .select('id, tenant_id')
            .eq('email', email)
            .maybeSingle(); 

        if (fetchError) throw fetchError;
        let tenantId = '';
        if (existingProfile) {
            console.error('User Already exists');
        } else {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (user) {
                tenantId = user.user_metadata?.tenant_id;
                console.log('Tenant ID:', tenantId);
            } else {
                console.log('No user is logged in.');
            }

            const { data: authUser, error: authError } =
                await supabase.auth.signUp({
                    email,
                    password: password ?? 'user@123',
                    options: {
                        data: { first_name, last_name, tenant_id: tenantId },
                    },
                });

            if (authError) throw authError;
            const userId = authUser?.user?.id; 

            const { error: insertProfileError } = await supabase
                .from('profiles')
                .insert({
                    id: userId,
                    email,
                    tenant_id: tenantId,
                    role: 'user',
                });

            if (insertProfileError) throw insertProfileError;

            const { data: saleUser, error: insertSalesError } = await supabase
                .from('sales')
                .insert({
                    first_name,
                    last_name,
                    email,
                    user_id: userId,
                    administrator: false,
                    tenant_id: tenantId,
                    disabled,
                });

            if (insertSalesError) throw insertSalesError;
            return saleUser;
        }
    } catch (error) {
        console.error('Error creating sales profile:', error);
        return {};
    }
};

export const AuthChecker = ({ navigate, setIsLoading }: any) => {
    useEffect(() => {
        const checkUser = async () => {
            setIsLoading(true);
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (user) {
                navigate('/'); 
            }
            setIsLoading(false);
        };

        checkUser();
    }, [navigate]);

    return;
};

export default AuthChecker;

export const getUserTenantId = async (): Promise<string | null> => {
    const { data: user }: any = await supabase.auth.getUser();
    return user?.user?.user_metadata?.tenant_id || null;
};

export const deleteUser = async (userId: string) => {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (error) {
        console.error('Error deleting user:', error.message);
    } else {
        console.log('User deleted successfully');
    }
};

export const updateUserPassword = async (
    userId: string,
    newPassword: string
) => {
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { password: newPassword }
    );

    if (error) {
        console.error('Error updating password:', error.message);
        return null;
    }

    console.log('Password updated successfully:', data);
    return data;
};
