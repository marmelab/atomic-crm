set check_function_bodies = off;

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
      attachment_changes jsonb;
    BEGIN
      request_headers := coalesce(
        nullif(current_setting('request.headers', true), '')::jsonb,
        '{}'::jsonb
      );
      auth_header := request_headers ->> 'authorization';

      IF auth_header IS NULL OR auth_header = '' THEN
        attachment_changes := nullif(
          current_setting('atomic_crm.note_attachment_changes', true),
          ''
        )::jsonb;

        IF attachment_changes IS NOT NULL AND cardinality(OLD.attachments) > 0 THEN
          PERFORM set_config(
            'atomic_crm.note_attachment_changes',
            (
              attachment_changes || jsonb_build_array(
                jsonb_build_object(
                  'type', TG_OP,
                  'old_record', jsonb_build_object('attachments', OLD.attachments),
                  'record', jsonb_build_object('attachments', NEW.attachments)
                )
              )
            )::text,
            true
          );
        END IF;

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
        url := public.get_note_attachments_function_url(),
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
    $function$
;
