DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vault.secrets WHERE name = 'delete_note_attachments_secret'
  ) THEN
    PERFORM vault.create_secret(
      gen_random_uuid()::text,
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
      function_url text;
      function_secret text;
    BEGIN
      IF TG_OP = 'DELETE' AND coalesce(cardinality(OLD.attachments), 0) = 0 THEN
        RETURN OLD;
      END IF;

      function_url := public.get_note_attachments_function_url();

      IF function_url IS NULL THEN
        RAISE WARNING 'Cannot resolve delete_note_attachments function URL, note attachments were not deleted';

        IF TG_OP = 'DELETE' THEN
          RETURN OLD;
        END IF;

        RETURN NEW;
      END IF;

      BEGIN
        SELECT decrypted_secret INTO function_secret
        FROM vault.decrypted_secrets
        WHERE name = 'delete_note_attachments_secret';
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Cannot read Vault secret delete_note_attachments_secret: %', SQLERRM;

        IF TG_OP = 'DELETE' THEN
          RETURN OLD;
        END IF;

        RETURN NEW;
      END;

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
        url := function_url,
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

CREATE OR REPLACE FUNCTION public.get_note_attachments_function_url()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
    DECLARE
      issuer text;
      function_url text;
    BEGIN
      issuer := coalesce(
        nullif(current_setting('request.jwt.claim.iss', true), ''),
        (
          coalesce(
            nullif(current_setting('request.jwt.claims', true), ''),
            '{}'
          )::jsonb ->> 'iss'
        )
      );
      issuer := nullif(issuer, '');
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

      RETURN NULL;
    END;
    $function$
;
