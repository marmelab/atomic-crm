-- Phase 2 Wave 2.3B: Defuse external network triggers
-- Remove avatar/favicon external fetch from save triggers.
-- These made external HTTP calls during INSERT/UPDATE, slowing writes
-- and risking failures on network issues.
--
-- Kept: cleanup_note_attachments, lowercase_email_jsonb, set_sales_id_default

BEGIN;

-- ============================================================
-- 1. Replace handle_company_saved — no more favicon fetch
-- ============================================================
CREATE OR REPLACE FUNCTION "public"."handle_company_saved"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Favicon enrichment removed (Phase 2).
    -- Company logos can be set manually or via a background job.
    RETURN NEW;
END;
$$;

-- ============================================================
-- 2. Replace handle_contact_saved — no more avatar fetch
-- ============================================================
CREATE OR REPLACE FUNCTION "public"."handle_contact_saved"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Avatar enrichment removed (Phase 2).
    -- Avatars can be set manually or via a background job.
    RETURN NEW;
END;
$$;

-- ============================================================
-- 3. Drop the external fetch helper functions
-- ============================================================
DROP FUNCTION IF EXISTS "public"."get_avatar_for_email"(text);
DROP FUNCTION IF EXISTS "public"."get_domain_favicon"(text);

-- ============================================================
-- 4. Drop the http extension if nothing else uses it
--    (cleanup_note_attachments uses net.http_post, not extensions.http)
-- ============================================================
-- Note: we keep the http extension for now since other functions may
-- reference extensions.http indirectly. Safe to remove in a future pass.

COMMIT;
