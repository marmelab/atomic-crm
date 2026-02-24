CREATE EXTENSION IF NOT EXISTS pg_net;

DO $migration$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS on_contact_notes_changed_delete_note_attachments ON public.contact_notes';
  EXECUTE 'DROP TRIGGER IF EXISTS on_deal_notes_changed_delete_note_attachments ON public.deal_notes';

  EXECUTE 'DROP FUNCTION IF EXISTS public.cleanup_note_attachments()';
  EXECUTE 'DROP FUNCTION IF EXISTS public.note_attachments_webhook_url()';
  -- TODO: remove these legacy drops before merge once the old function names are no longer needed.
  EXECUTE 'DROP FUNCTION IF EXISTS public.atomic_crm_notify_note_attachment_cleanup()';
  EXECUTE 'DROP FUNCTION IF EXISTS public.atomic_crm_note_attachments_webhook_url()';

  EXECUTE $url_sql$
    CREATE OR REPLACE FUNCTION public.note_attachments_webhook_url()
    RETURNS text
    LANGUAGE plpgsql
    AS $function$
    DECLARE
      issuer text;
      project_ref text;
      function_url text;
    BEGIN
      issuer := nullif(current_setting('request.jwt.claim.iss', true), '');

      IF issuer IS NOT NULL THEN
        issuer := rtrim(issuer, '/');
        IF right(issuer, 8) = '/auth/v1' THEN
          function_url :=
            left(issuer, length(issuer) - 8) || '/functions/v1/delete_note_attachments';

          IF function_url LIKE 'http://127.0.0.1:%' THEN
            RETURN replace(
              function_url,
              'http://127.0.0.1:',
              'http://host.docker.internal:'
            );
          END IF;

          IF function_url LIKE 'http://localhost:%' THEN
            RETURN replace(
              function_url,
              'http://localhost:',
              'http://host.docker.internal:'
            );
          END IF;

          RETURN function_url;
        END IF;
      END IF;

      project_ref := nullif(current_setting('app.settings.project_ref', true), '');
      IF project_ref IS NOT NULL THEN
        RETURN format(
          'https://%s.supabase.co/functions/v1/delete_note_attachments',
          project_ref
        );
      END IF;

      RETURN 'http://host.docker.internal:54321/functions/v1/delete_note_attachments';
    END;
    $function$;
  $url_sql$;

  EXECUTE $cleanup_sql$
    CREATE OR REPLACE FUNCTION public.cleanup_note_attachments()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO ''
    AS $function$
    DECLARE
      payload jsonb;
      request_headers jsonb;
      auth_header text;
    BEGIN
      request_headers := coalesce(
        nullif(current_setting('request.headers', true), '')::jsonb,
        '{}'::jsonb
      );
      auth_header := request_headers ->> 'authorization';

      IF auth_header IS NULL OR auth_header = '' THEN
        IF TG_OP = 'DELETE' THEN
          RETURN OLD;
        END IF;

        RETURN NEW;
      END IF;

      payload := jsonb_build_object(
        'old_record', OLD,
        'record', NEW,
        'type', TG_OP
      );

      PERFORM net.http_post(
        url := public.note_attachments_webhook_url(),
        body := payload,
        params := '{}'::jsonb,
        headers := jsonb_build_object(
          'Content-Type',
          'application/json',
          'Authorization',
          auth_header
        ),
        timeout_milliseconds := 10000
      );

      IF TG_OP = 'DELETE' THEN
        RETURN OLD;
      END IF;

      RETURN NEW;
    END;
    $function$;
  $cleanup_sql$;

  EXECUTE 'CREATE TRIGGER on_contact_notes_changed_delete_note_attachments AFTER DELETE OR UPDATE ON public.contact_notes FOR EACH ROW EXECUTE FUNCTION public.cleanup_note_attachments()';
  EXECUTE 'CREATE TRIGGER on_deal_notes_changed_delete_note_attachments AFTER DELETE OR UPDATE ON public.deal_notes FOR EACH ROW EXECUTE FUNCTION public.cleanup_note_attachments()';
END;
$migration$;
