import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { corsHeaders, createErrorResponse } from '../_shared/utils.ts';

async function updateSaleDisabled(user_id: string, disabled: boolean) {
    return await supabaseAdmin
        .from('sales')
        .update({ disabled: disabled ?? false })
        .eq('user_id', user_id);
}

async function updateSaleAdministrator(
    user_id: string,
    administrator: boolean
) {
    const { data: sales, error: salesError } = await supabaseAdmin
        .from('sales')
        .update({ administrator })
        .eq('user_id', user_id)
        .select('*');

    if (!sales?.length || salesError) {
        console.error('Error inviting user:', salesError);
        throw salesError ?? new Error('Failed to update sale');
    }
    return sales.at(0);
}

async function inviteUser(req: Request) {
    const { email, password, first_name, last_name, disabled, administrator } =
        await req.json();

    const { data, error: userError } =
        await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            user_metadata: { first_name, last_name },
        });

    const { error: emailError } =
        await supabaseAdmin.auth.admin.inviteUserByEmail(email);

    if (!data?.user || userError) {
        console.error(`Error inviting user: user_error=${userError}`);
        return createErrorResponse(500, 'Internal Server Error');
    }

    if (!data?.user || userError || emailError) {
        console.error(`Error inviting user, email_error=${emailError}`);
        return createErrorResponse(500, 'Failed to send invitation mail');
    }

    try {
        await updateSaleDisabled(data.user.id, disabled);
        const sale = await updateSaleAdministrator(data.user.id, administrator);

        return new Response(
            JSON.stringify({
                data: sale,
            }),
            {
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            }
        );
    } catch (e) {
        console.error('Error patching sale:', e);
        return createErrorResponse(500, 'Internal Server Error');
    }
}

async function patchUser(req: Request) {
    const { sales_id, email, first_name, last_name, administrator, disabled } =
        await req.json();
    const { data: sale } = await supabaseAdmin
        .from('sales')
        .select('*')
        .eq('id', sales_id)
        .single();

    if (!sale) {
        return createErrorResponse(404, 'Not Found');
    }

    const { data, error: userError } =
        await supabaseAdmin.auth.admin.updateUserById(sale.user_id, {
            email,
            ban_duration: disabled ? '87600h' : 'none',
            user_metadata: { first_name, last_name },
        });

    if (!data?.user || userError) {
        console.error('Error patching user:', userError);
        return createErrorResponse(500, 'Internal Server Error');
    }

    try {
        await updateSaleDisabled(data.user.id, disabled);
        const sale = await updateSaleAdministrator(data.user.id, administrator);

        return new Response(
            JSON.stringify({
                data: sale,
            }),
            {
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            }
        );
    } catch (e) {
        console.error('Error patching sale:', e);
        return createErrorResponse(500, 'Internal Server Error');
    }
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: corsHeaders,
        });
    }

    const authHeader = req.headers.get('Authorization')!;
    const localClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
    );

    const { data } = await localClient.auth.getUser();
    if (!data?.user) {
        return createErrorResponse(401, 'Unauthorized');
    }

    if (req.method === 'POST') {
        return inviteUser(req);
    }

    if (req.method === 'PATCH') {
        return patchUser(req);
    }

    return createErrorResponse(405, 'Method Not Allowed');
});
