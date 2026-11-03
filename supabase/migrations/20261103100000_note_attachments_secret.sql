DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vault.secrets WHERE name = 'delete_note_attachments_secret'
  ) THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'delete_note_attachments_secret'
    );
  END IF;
END $$;

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.cleanup_note_attachments()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
    DECLARE
      payload jsonb;
      function_secret text;
    BEGIN
      IF TG_OP = 'DELETE' AND coalesce(cardinality(OLD.attachments), 0) = 0 THEN
        RETURN OLD;
      END IF;

      SELECT decrypted_secret INTO function_secret
      FROM vault.decrypted_secrets
      WHERE name = 'delete_note_attachments_secret';

      IF function_secret IS NULL THEN
        RAISE WARNING 'Vault secret delete_note_attachments_secret is missing, note attachments were not deleted';

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
          'x-note-attachments-secret',
          function_secret
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
