import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { corsHeaders, createErrorResponse } from '../_shared/utils.ts';

async function initiateCall(req: Request) {
    const { recipient_id,caller_id,phone_number } = await req.json();

    return await supabaseAdmin
        .from('calls')
        .insert({ recipient_id,caller_id,phone_number })
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

    const call = await (async () => {
        if (req.method === 'POST') {
            return initiateCall(req);
        }
        return createErrorResponse(405, 'Method Not Allowed');
    })();

    return new Response(JSON.stringify(call.data), {
        headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
        },
    });
});
