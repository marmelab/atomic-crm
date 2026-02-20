CREATE EXTENSION IF NOT EXISTS pg_net;

DROP TRIGGER IF EXISTS on_contact_notes_deleted_delete_note_attachments
ON public.contact_notes;

DROP TRIGGER IF EXISTS on_deal_notes_deleted_delete_note_attachments
ON public.deal_notes;

DROP TRIGGER IF EXISTS on_contact_notes_changed_delete_note_attachments
ON public.contact_notes;

DROP TRIGGER IF EXISTS on_deal_notes_changed_delete_note_attachments
ON public.deal_notes;

CREATE OR REPLACE FUNCTION public.atomic_crm_note_attachments_webhook_url()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  issuer text;
  project_ref text;
  function_url text;
BEGIN
  issuer := nullif(current_setting('request.jwt.claim.iss', true), '');

  IF issuer IS NOT NULL THEN
    issuer := regexp_replace(issuer, '/+$', '');
    IF issuer LIKE '%/auth/v1' THEN
      function_url := regexp_replace(
        issuer,
        '/auth/v1$',
        '/functions/v1/delete_note_attachments'
      );

      IF function_url ~ '^http://(127\\.0\\.0\\.1|localhost):' THEN
        RETURN regexp_replace(
          function_url,
          '^http://(127\\.0\\.0\\.1|localhost):',
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
$$;

CREATE OR REPLACE FUNCTION public.atomic_crm_notify_note_attachment_cleanup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payload jsonb;
BEGIN
  payload := jsonb_build_object(
    'old_record', OLD,
    'record', NEW,
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA
  );

  PERFORM net.http_post(
    url := public.atomic_crm_note_attachments_webhook_url(),
    body := payload,
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type',
      'application/json',
      'x-webhook-secret',
      'atomic-crm-note-attachments-webhook-secret'
    ),
    timeout_milliseconds := 1000
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_contact_notes_changed_delete_note_attachments
AFTER DELETE OR UPDATE ON public.contact_notes
FOR EACH ROW
EXECUTE FUNCTION public.atomic_crm_notify_note_attachment_cleanup();

CREATE TRIGGER on_deal_notes_changed_delete_note_attachments
AFTER DELETE OR UPDATE ON public.deal_notes
FOR EACH ROW
EXECUTE FUNCTION public.atomic_crm_notify_note_attachment_cleanup();
