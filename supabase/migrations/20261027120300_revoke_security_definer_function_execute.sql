-- Fix the Security Advisor "anon_security_definer_function_executable" and
-- "authenticated_security_definer_function_executable" warnings.

-- Trigger functions: Postgres only checks EXECUTE when the trigger is created,
-- not when it fires, so no API role needs it. Revoking it removes their
-- /rest/v1/rpc/<name> endpoints.
revoke all on function
    public.cleanup_note_attachments(),
    public.handle_contact_note_created_or_updated(),
    public.handle_new_user(),
    public.handle_update_user()
from public, anon, authenticated;

-- is_admin() is security invoker since the previous migration, and only used
-- by the configuration RLS policies, which apply to authenticated users.
revoke all on function public.is_admin() from public, anon;

-- public.is_initialized() is deliberately left as is: the anon role calls it
-- through public.init_state before sign-in, and it must stay SECURITY DEFINER
-- because anon cannot read public.sales. It only exposes whether at least one
-- user exists, which init_state already returns.
