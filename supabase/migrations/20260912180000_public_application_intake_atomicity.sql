-- Application Intake Atomicity + Idempotency slice.
--
-- Hand-written (not CLI-generated): this sandbox has no Docker/Podman
-- available, so `supabase db diff` cannot spin up its shadow database (same
-- constraint documented in 20260909100000_scholarship_pricing_and_capacity.sql).
-- Every statement below matches supabase/schemas/{02_functions,06_grants}.sql
-- exactly — see 02_functions.sql's own header comment on
-- submit_public_application() for the full design rationale.
--
-- Root cause being fixed: supabase/functions/public_application/index.ts's
-- handleSubmit previously issued Contact -> Deal -> (Waitlist sync) ->
-- Application -> Task as separate PostgREST round-trips with no shared
-- transaction. A failure between any two steps left durable partial state
-- — including a case no retry could ever repair: once an Application exists
-- matching the resubmitted answers exactly, the exact-retry fast path
-- returns immediately without ever attempting Task creation again, so a
-- Task that failed to create on the first attempt would never be created
-- on any later identical retry. This migration adds one Postgres function
-- performing the whole sequence inside a single transaction (Contact
-- resolve/create, Deal resolve/create, Waitlist sync for a reused Deal,
-- Application resolve/update/create, Review Task ensure) plus an advisory
-- transaction lock serializing concurrent submissions for the same
-- applicant identity. Callable ONLY by service_role — not a new public
-- capability, the existing Edge Function remains the sole public entry
-- point and is updated in the same slice to call this instead of
-- sequencing independent writes itself.
--
-- Revision (adversarial-review pass, before first deployment): the
-- original draft's no-op fast path trusted "Application matches" alone,
-- which is unsafe against a legacy row the OLD non-atomic code already
-- left behind (Application exists, Task doesn't) before this function was
-- ever deployed — see the function's own inline comment at that check.

CREATE OR REPLACE FUNCTION "public"."submit_public_application"(
    "p_offer_id" bigint,
    "p_cohort_id" bigint,
    "p_first_name" text,
    "p_last_name" text,
    "p_email" text,
    "p_phone" text,
    "p_answers" jsonb
) RETURNS jsonb
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_email text := lower(trim(p_email));
  v_contact contacts%ROWTYPE;
  v_is_dne boolean;
  v_deal deals%ROWTYPE;
  v_deal_reused boolean := false;
  v_pending_app applications%ROWTYPE;
  v_answers_match boolean := false;
  v_application_id bigint;
  v_existing_application_id bigint;
  v_sales_id bigint;
  v_has_pending_task boolean;
  v_applicant_name text;
BEGIN
  IF p_offer_id IS NULL THEN
    RAISE EXCEPTION 'offer_invalid' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF coalesce(trim(p_first_name), '') = '' OR coalesce(trim(p_last_name), '') = '' THEN
    RAISE EXCEPTION 'name_invalid' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_email = '' THEN
    RAISE EXCEPTION 'email_invalid' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Defense-in-depth structural re-check — the Edge Function already
  -- validated offer/cohort (including the Denver-timezone open-window
  -- logic this function deliberately does not duplicate) before ever
  -- calling here; this is the same minimal FK-existence backstop
  -- handle_deal_saved() already applies to any deals insert regardless.
  IF NOT EXISTS (SELECT 1 FROM offers WHERE id = p_offer_id AND is_active) THEN
    RAISE EXCEPTION 'offer_invalid' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_cohort_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM cohorts WHERE id = p_cohort_id AND offer_id = p_offer_id
  ) THEN
    RAISE EXCEPTION 'cohort_invalid' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Serialize concurrent submissions for the same applicant identity for
  -- the rest of this transaction (released automatically at commit/
  -- rollback) — see header comment.
  PERFORM pg_advisory_xact_lock(hashtext('submit_public_application:' || v_email));

  -- Read current state ONCE, before any write (mirrors submitApplication.ts
  -- / the pre-atomicity Edge Function exactly) so a true no-op retry can be
  -- recognized with ZERO writes.
  SELECT * INTO v_contact
  FROM contacts c
  WHERE EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(c.email_jsonb, '[]'::jsonb)) AS e
    WHERE lower(trim(e ->> 'email')) = v_email
  )
  ORDER BY c.id ASC
  LIMIT 1;

  v_is_dne := v_contact.id IS NOT NULL AND v_contact.sales_eligibility = 'do_not_engage';

  IF v_contact.id IS NOT NULL AND NOT v_is_dne THEN
    SELECT * INTO v_deal
    FROM deals d
    WHERE d.contact_id = v_contact.id
      AND d.offer_id = p_offer_id
      AND (p_cohort_id IS NULL OR d.cohort_id = p_cohort_id)
      AND d.archived_at IS NULL
      AND d.stage <> 'won'
      AND d.outcome IS NULL
    ORDER BY d.id ASC
    LIMIT 1;
  END IF;

  IF v_deal.id IS NOT NULL THEN
    SELECT * INTO v_pending_app
    FROM applications a
    WHERE a.opportunity_id = v_deal.id
    ORDER BY a.id DESC
    LIMIT 1;
    IF v_pending_app.id IS NOT NULL AND v_pending_app.status <> 'pending' THEN
      v_pending_app := NULL;
    END IF;
  END IF;

  IF v_pending_app.id IS NOT NULL THEN
    -- jsonb equality is key-order-independent (both sides are stored in
    -- Postgres's own canonical jsonb form) — mirrors answersEqual()
    -- exactly without needing a manual key-by-key comparison.
    v_answers_match := p_answers = v_pending_app.raw_answers;
  END IF;

  -- Adversarial-review correction: an earlier draft of this function
  -- trusted "Application matches" alone, reasoning that atomicity makes
  -- "Application exists but Task doesn't" unreachable. That's only true
  -- for rows THIS function itself created — it is NOT true for a row the
  -- OLD, pre-atomicity code path already left behind before this function
  -- was ever deployed (exactly the legacy-partial-state case this whole
  -- migration exists to repair). Without this check, such a legacy row
  -- would hit this fast path on its very next matching resubmission and
  -- return early WITHOUT ever creating the missing Task — silently
  -- perpetuating the original bug for any row that predates this
  -- deployment. Checking Task existence here too (mirrors
  -- submitApplication.ts's own identical check) costs nothing once this
  -- function has been the only writer for a while (the Task will simply
  -- already exist), and is exactly what repairs a legacy row instead of
  -- rubber-stamping it.
  IF v_contact.id IS NOT NULL AND NOT v_is_dne THEN
    SELECT EXISTS (
      SELECT 1 FROM tasks
      WHERE contact_id = v_contact.id
        AND type = 'review_application'
        AND done_date IS NULL
    ) INTO v_has_pending_task;
  END IF;

  IF v_pending_app.id IS NOT NULL AND v_answers_match AND coalesce(v_has_pending_task, false) THEN
    RETURN jsonb_build_object(
      'status', 'submitted',
      'application_id', v_pending_app.id,
      'dne_auto_resolved', false
    );
  END IF;

  -- Resolve or create the Contact.
  IF v_contact.id IS NOT NULL THEN
    UPDATE contacts SET last_seen = now() WHERE id = v_contact.id RETURNING * INTO v_contact;
  ELSE
    INSERT INTO contacts (
      first_name, last_name, email_jsonb, phone_jsonb, tags,
      has_newsletter, first_seen, last_seen, sales_eligibility
    ) VALUES (
      p_first_name, p_last_name,
      jsonb_build_array(jsonb_build_object('email', p_email, 'type', 'Other')),
      CASE WHEN coalesce(p_phone, '') <> ''
        THEN jsonb_build_array(jsonb_build_object('number', p_phone, 'type', 'Other'))
        ELSE '[]'::jsonb
      END,
      ARRAY[]::bigint[],
      false, now(), now(), 'normal'
    ) RETURNING * INTO v_contact;
  END IF;

  -- Resolve or create the Deal (never reused for a DNE contact — a fresh
  -- Deal already in the exited state, exactly like both prior
  -- implementations).
  IF v_deal.id IS NULL THEN
    INSERT INTO deals (
      contact_id, offer_id, cohort_id, stage, outcome, owner_decision,
      amount, entry_path, description
    ) VALUES (
      v_contact.id, p_offer_id, p_cohort_id, 'application_received',
      CASE WHEN v_is_dne THEN 'lost' ELSE NULL END,
      CASE WHEN v_is_dne THEN 'do_not_engage' ELSE NULL END,
      (SELECT current_price FROM offers WHERE id = p_offer_id),
      'application_form', ''
    ) RETURNING * INTO v_deal;
    -- name/snapshot fields are computed by the existing BEFORE trigger
    -- handle_deal_saved(); the existing AFTER trigger on_deal_waitlist_sync
    -- fires automatically for this fresh INSERT.
  ELSE
    v_deal_reused := true;
    IF NOT v_is_dne THEN
      -- Reusing writes nothing to `deals`, so on_deal_waitlist_sync never
      -- fires for this path — mirror it explicitly (same rule, same WHERE
      -- clause, as handle_deal_waitlist_sync() itself).
      UPDATE waitlist_entries
      SET status = 'converted', converted_at = now(), converted_opportunity_id = v_deal.id
      WHERE contact_id = v_deal.contact_id
        AND offer_id = v_deal.offer_id
        AND status IN ('waiting', 'invited')
        AND (cohort_id IS NULL OR cohort_id = v_deal.cohort_id);
    END IF;
  END IF;

  -- Resolve, update-in-place, or create the Application.
  IF v_pending_app.id IS NOT NULL THEN
    UPDATE applications
    SET raw_answers = p_answers, submitted_at = now()
    WHERE id = v_pending_app.id
    RETURNING id INTO v_application_id;
  ELSE
    SELECT a.id INTO v_existing_application_id
    FROM applications a
    WHERE a.opportunity_id = v_deal.id
    ORDER BY a.id DESC
    LIMIT 1;

    IF v_existing_application_id IS NOT NULL THEN
      v_application_id := v_existing_application_id;
    ELSE
      INSERT INTO applications (opportunity_id, raw_answers, submitted_at, status, reviewed_at)
      VALUES (
        v_deal.id, p_answers, now(),
        CASE WHEN v_is_dne THEN 'do_not_engage' ELSE 'pending' END,
        CASE WHEN v_is_dne THEN now() ELSE NULL END
      ) RETURNING id INTO v_application_id;
    END IF;
  END IF;

  -- Review Application Task: idempotent (skips if a pending one already
  -- exists), never created for the DNE auto-resolve path.
  IF NOT v_is_dne THEN
    SELECT EXISTS (
      SELECT 1 FROM tasks
      WHERE contact_id = v_contact.id
        AND type = 'review_application'
        AND done_date IS NULL
    ) INTO v_has_pending_task;

    IF NOT v_has_pending_task THEN
      SELECT id INTO v_sales_id FROM sales WHERE administrator = true LIMIT 1;
      v_applicant_name := trim(both ' ' from coalesce(v_contact.first_name, '') || ' ' || coalesce(v_contact.last_name, ''));
      INSERT INTO tasks (contact_id, type, text, due_date, status, sales_id)
      VALUES (
        v_contact.id, 'review_application',
        'Review ' || v_applicant_name || '''s application',
        now(), 'pending', v_sales_id
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'status', 'submitted',
    'application_id', v_application_id,
    'dne_auto_resolved', v_is_dne
  );
END;
$$;

revoke all on function public.submit_public_application(bigint, bigint, text, text, text, text, jsonb) from public;
revoke all on function public.submit_public_application(bigint, bigint, text, text, text, text, jsonb) from anon;
revoke all on function public.submit_public_application(bigint, bigint, text, text, text, text, jsonb) from authenticated;
grant all on function public.submit_public_application(bigint, bigint, text, text, text, text, jsonb) to service_role;
