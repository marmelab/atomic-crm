// // Follow this setup guide to integrate the Deno language server with your editor:
// // https://deno.land/manual/getting_started/setup_your_environment
// // This enables autocomplete, go to definition, etc.

// // Setup type definitions for built-in Supabase Runtime APIs
// import "jsr:@supabase/functions-js/edge-runtime.d.ts"

// console.log("Hello from Functions!")

// Deno.serve(async (req) => {
//   const { name } = await req.json()
//   const data = {
//     message: `Hello ${name}!`,
//   }

//   return new Response(
//     JSON.stringify(data),
//     { headers: { "Content-Type": "application/json" } },
//   )
// })

// /* To invoke locally:
//   1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
//   2. Make an HTTP request:

//   curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/postmark-inbound' \
//     --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
//     --header 'Content-Type: application/json' \
//     --data '{"name":"Functions"}'

// */


import { createClient } from 'npm:@supabase/supabase-js@2'

// Admin client (bypasses RLS) for server-side inserts
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,               // injected by Supabase
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!   // injected by Supabase
)

// Simple Basic Auth check against secrets you’ll set in step 4
function checkBasicAuth(req: Request) {
  const auth = req.headers.get('authorization') ?? ''
  const [scheme, encoded] = auth.split(' ')
  if (scheme !== 'Basic' || !encoded) return false
  const [user, pass] = atob(encoded).split(':')
  return (
    user === Deno.env.get('POSTMARK_WEBHOOK_USER') &&
    pass === Deno.env.get('POSTMARK_WEBHOOK_PASSWORD')
  )
}

Deno.serve(async (req) => {
  // Basic Auth (Postmark supports including credentials in the URL or UI)
  // https://username:password@your-host/path
  if (!checkBasicAuth(req)) {
    return new Response('Forbidden', { status: 403 })
  }

  // Optional: light IP check if you decide to maintain an allowlist.
  // Postmark publishes webhook IP ranges; at the app level this is best-effort only.
  // const xff = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()

  try {
    const payload = await req.json()

    const { error } = await supabaseAdmin
      .from('postmark_inbound_raw')
      .insert({ payload })

    if (error) {
      return new Response(`DB error: ${error.message}`, { status: 500 })
    }

    return new Response('ok', { status: 200 })
  } catch (e) {
    return new Response(`Bad request: ${(e as Error).message}`, { status: 400 })
  }
})