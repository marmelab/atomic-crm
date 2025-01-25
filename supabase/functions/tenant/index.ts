import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { corsHeaders, createErrorResponse } from '../_shared/utils.ts';

async function createTenant(req: Request) {
    const { name } = await req.json();

    return await supabaseAdmin
        .from('tenants')
        .insert({ name })
        .select('*')
        .single();
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: corsHeaders,
        });
    }

    const tenant = await (async () => {
        if (req.method === 'POST') {
            return createTenant(req);
        }
        return createErrorResponse(405, 'Method Not Allowed');
    })();

    return new Response(JSON.stringify(tenant.data), {
        headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
        },
    });
});
