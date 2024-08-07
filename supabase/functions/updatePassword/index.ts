import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, createErrorResponse } from '../_shared/utils.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';

async function updatePassword(req: Request, user: any) {
    const { currentPassword, newPassword } = await req.json();

    const { _, error: errorLogin } =
        await supabaseAdmin.auth.signInWithPassword({
            email: user.email,
            password: currentPassword,
        });

    if (errorLogin) {
        return createErrorResponse(400, 'Invalid current password');
    }

    const { data, error: errorUpdate } = await supabaseAdmin.auth.updateUser({
        password: newPassword,
    });

    if (!data || errorUpdate) {
        return createErrorResponse(500, 'Internal Server Error');
    }

    return new Response(
        JSON.stringify({
            data,
        }),
        {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
    );
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

    if (req.method === 'PATCH') {
        return updatePassword(req, data.user);
    }

    return createErrorResponse(405, 'Method Not Allowed');
});
