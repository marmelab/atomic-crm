import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
        'authorization, x-client-info, apikey, content-type',
};

const supabaseServiceClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    }
);

function createErrorResponse(status: number, message: string) {
    return new Response(JSON.stringify({ status, message }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        status,
    });
}

async function inviteUser(req: Request) {
    const { email, password, first_name, last_name } = await req.json();

    const { data, error } = await supabaseServiceClient.auth.admin.createUser({
        email,
        password,
        user_metadata: { first_name, last_name },
    });

    if (!data || error) {
        console.error('Error inviting user:', error);
        return createErrorResponse(500, 'Internal Server Error');
    }

    return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
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

    return createErrorResponse(405, 'Method Not Allowed');
});
