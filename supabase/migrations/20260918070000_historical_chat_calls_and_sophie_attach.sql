-- ===========================================================================
-- Historical sales conversations that existed only in Acuity
-- ===========================================================================
-- Thirteen bookings on Acuity type 78497441 ("chat", a type Leif later
-- deleted) sit in Acuity and nowhere in the CRM. They were real sales
-- conversations with real people, so losing them loses relationship
-- history — four of these people have no CRM record at all.
--
-- What this migration deliberately does NOT do is decide which Opportunity
-- each conversation belonged to. "chat" is a generic "let's talk" slot: it
-- never named an Offer, and the evidence confirms that rather than
-- contradicting it. Of the four 2026 "chat" bookings whose person already
-- has an Opportunity, three are Growing Yourself Up and one is The Living
-- Example; of the three still-upcoming ones, all three are Living Example.
-- The appointment type simply does not determine the Offer here.
--
-- So each call is recorded as the thing actually known — this person had a
-- sales conversation with Leif on this date, through this appointment type
-- — with opportunity_id left NULL rather than guessed. That is Rule C
-- ("evidence does not establish enough Opportunity state -> preserve the
-- historical Sales Call at Contact level"), and the architecture supports
-- it: fifteen historical calls already live in exactly this shape.
--
-- No task is created for any of them. A 2025 conversation is history, not
-- work waiting on Leif, and turning thirteen of them into Needs Attention
-- rows would bury the three genuine open questions that are there now.
-- Five of these people DO have an existing Opportunity, and Leif can
-- attach any of those in one click from the existing matching screen if he
-- remembers which relationship the conversation belonged to.
--
-- Nothing here invents attendance, a no-show, a cancellation, an outcome,
-- an Application, cohort intent, or commercial terms.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Two names that were never names.
-- ---------------------------------------------------------------------------
-- Both were written by an earlier Acuity backfill that split a display name
-- badly. Contact 186 carries an email address in the first_name column, so
-- the Pipeline shows "mowensfernandez@gmail.com" where a person's name
-- belongs; contact 90 lost its surname entirely. Acuity holds the real
-- names (firstName/lastName are separate fields there), so these are
-- corrections from source, not invention.
UPDATE contacts SET first_name = 'Maria', last_name = 'Owens Fernandez'
 WHERE id = 186 AND first_name LIKE '%@%';

UPDATE contacts SET first_name = 'Miloš', last_name = 'Bojović'
 WHERE id = 90 AND coalesce(last_name, '') = '';

-- ---------------------------------------------------------------------------
-- 2. Sophie Russell's unmatched call — deterministic, so it is attached.
-- ---------------------------------------------------------------------------
-- Sales call 52, 2026-08-27, Acuity type 91345095 (Mini Deep Dive), which
-- resolves through the temporal map to The Living Example on that date.
-- Contact 98 has exactly two Opportunities: one Living Example (87) and one
-- Growing Yourself Up (88). The appointment type names the Offer and only
-- one Opportunity carries it, so there is one compatible answer and no
-- choice to guess at.
--
-- Deal 87 already carries outcome 'lost' and stays that way: attaching a
-- historical call must not reopen a closed relationship, and this call
-- happened the same day the Opportunity was created and closed.
DO $$
DECLARE
  v_offer_for_call bigint;
  v_deal_offer     bigint;
BEGIN
  SELECT offer_id INTO v_offer_for_call
    FROM resolve_acuity_appointment_type('91345095', DATE '2026-08-27');
  SELECT offer_id INTO v_deal_offer FROM deals WHERE id = 87;

  IF v_offer_for_call IS NULL OR v_offer_for_call IS DISTINCT FROM v_deal_offer THEN
    RAISE EXCEPTION 'Sophie attach is not deterministic: call resolves to offer %, deal 87 is offer %',
      v_offer_for_call, v_deal_offer;
  END IF;

  IF (SELECT opportunity_id FROM sales_calls WHERE id = 52) IS NULL THEN
    UPDATE sales_calls SET opportunity_id = 87 WHERE id = 52;
    INSERT INTO sales_call_events (sales_call_id, kind, occurred_at)
    VALUES (52, 'opportunity_attached', now());
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. The four people who exist only in Acuity.
-- ---------------------------------------------------------------------------
-- Matched on email first so a re-run can never create a second copy.
INSERT INTO contacts (first_name, last_name, email_jsonb, first_seen, last_seen)
SELECT v.first_name, v.last_name,
       jsonb_build_array(jsonb_build_object('email', v.email, 'type', 'other')),
       v.seen, v.seen
  FROM (VALUES
    ('Gricelda', 'Alva Brito', 'somaticrhealing@gmail.com',   TIMESTAMPTZ '2025-06-19T17:00:00Z'),
    ('Jo',       'Florence',   'johannajoy.bowser@gmail.com', TIMESTAMPTZ '2025-06-18T19:00:00Z'),
    ('Ryan',     'Dilts',      'ryandilts@gmail.com',         TIMESTAMPTZ '2025-05-23T21:00:00Z'),
    ('Jordan',   'Todoroff',   'jordan.j.todoroff@gmail.com', TIMESTAMPTZ '2025-05-21T18:00:00Z')
  ) v(first_name, last_name, email, seen)
 WHERE NOT EXISTS (
   SELECT 1 FROM contacts c
    WHERE EXISTS (
      SELECT 1 FROM jsonb_array_elements(c.email_jsonb) e
       WHERE lower(e->>'email') = lower(v.email))
 );

-- ---------------------------------------------------------------------------
-- 4. The thirteen conversations.
-- ---------------------------------------------------------------------------
-- Idempotent on acuity_appointment_id, which is Acuity's own stable id, so
-- a re-run is a no-op rather than a duplicate. Times are Acuity's real
-- recorded times converted to UTC, so precision is 'exact' and no clock
-- time is invented.
INSERT INTO sales_calls (
  contact_id, opportunity_id, status, attendance,
  original_scheduled_at, scheduled_at, scheduled_on, schedule_precision,
  reschedule_count, source, acuity_appointment_id, acuity_appointment_type_id
)
SELECT c.id, NULL, 'completed', NULL,
       v.at, v.at, v.at::date, 'exact',
       0, 'acuity', v.appt_id, '78497441'
  FROM (VALUES
    ('1742073118', 'samuelmilz@gmail.com',        TIMESTAMPTZ '2026-09-15T19:00:00Z'),
    ('1741896773', 'milosbjvc@gmail.com',         TIMESTAMPTZ '2026-09-01T19:00:00Z'),
    ('1729044607', 'esloanob@gmail.com',          TIMESTAMPTZ '2026-08-04T19:00:00Z'),
    ('1742477054', 'sigridkipperthau@gmail.com',  TIMESTAMPTZ '2026-07-29T17:00:00Z'),
    ('1534099684', 'annie.r.crete@gmail.com',     TIMESTAMPTZ '2025-09-18T18:00:00Z'),
    ('1515613503', 'anniemichaelw@gmail.com',     TIMESTAMPTZ '2025-08-08T19:00:00Z'),
    ('1504209988', 'elizahcoaching@gmail.com',    TIMESTAMPTZ '2025-08-01T20:00:00Z'),
    ('1504009836', 'laurel.schaffer@gmail.com',   TIMESTAMPTZ '2025-07-27T18:00:00Z'),
    ('1504955431', 'kerrifukui@gmail.com',        TIMESTAMPTZ '2025-07-23T20:00:00Z'),
    ('1487247597', 'somaticrhealing@gmail.com',   TIMESTAMPTZ '2025-06-19T17:00:00Z'),
    ('1481300270', 'johannajoy.bowser@gmail.com', TIMESTAMPTZ '2025-06-18T19:00:00Z'),
    ('1474557658', 'ryandilts@gmail.com',         TIMESTAMPTZ '2025-05-23T21:00:00Z'),
    ('1474203878', 'jordan.j.todoroff@gmail.com', TIMESTAMPTZ '2025-05-21T18:00:00Z')
  ) v(appt_id, email, at)
  JOIN LATERAL (
    SELECT c2.id FROM contacts c2
     WHERE EXISTS (
       SELECT 1 FROM jsonb_array_elements(c2.email_jsonb) e
        WHERE lower(e->>'email') = lower(v.email))
     ORDER BY c2.id
     LIMIT 1
  ) c ON true
 WHERE NOT EXISTS (
   SELECT 1 FROM sales_calls sc WHERE sc.acuity_appointment_id = v.appt_id);

-- The append-only history each call's existence implies.
INSERT INTO sales_call_events (sales_call_id, kind, occurred_at)
SELECT sc.id, 'booked', sc.scheduled_at
  FROM sales_calls sc
 WHERE sc.acuity_appointment_type_id = '78497441'
   AND sc.opportunity_id IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM sales_call_events e
      WHERE e.sales_call_id = sc.id AND e.kind = 'booked');

-- ---------------------------------------------------------------------------
-- 5. Prove the shape, then commit.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_chat bigint; v_dupes bigint; v_tasks bigint; v_active bigint; v_sophie bigint; v_names bigint;
BEGIN
  SELECT count(*) INTO v_chat FROM sales_calls WHERE acuity_appointment_type_id = '78497441';
  IF v_chat <> 16 THEN
    RAISE EXCEPTION 'expected 16 chat calls (13 historical + 3 already present), found %', v_chat;
  END IF;

  SELECT count(*) INTO v_dupes FROM (
    SELECT acuity_appointment_id FROM sales_calls
     WHERE acuity_appointment_id IS NOT NULL
     GROUP BY 1 HAVING count(*) > 1) z;
  IF v_dupes > 0 THEN
    RAISE EXCEPTION '% duplicated Acuity appointment id(s)', v_dupes;
  END IF;

  -- None of the thirteen may become work waiting on Leif.
  SELECT count(*) INTO v_tasks
    FROM tasks t JOIN sales_calls sc ON sc.id = t.sales_call_id
   WHERE sc.acuity_appointment_type_id = '78497441'
     AND sc.opportunity_id IS NULL AND t.done_date IS NULL;
  IF v_tasks > 0 THEN
    RAISE EXCEPTION '% historical chat call(s) created pending tasks', v_tasks;
  END IF;

  -- None of them may appear as active pipeline work.
  SELECT count(*) INTO v_active
    FROM sales_calls sc JOIN deals d ON d.id = sc.opportunity_id
   WHERE sc.acuity_appointment_type_id = '78497441'
     AND sc.scheduled_at < now()
     AND d.archived_at IS NULL AND d.stage <> 'won' AND d.outcome IS NULL
     AND d.stage = 'call_booked';
  IF v_active > 0 THEN
    RAISE EXCEPTION '% past chat call(s) left an Opportunity in Call Booked', v_active;
  END IF;

  SELECT opportunity_id INTO v_sophie FROM sales_calls WHERE id = 52;
  IF v_sophie IS DISTINCT FROM 87 THEN
    RAISE EXCEPTION 'Sophie call 52 is attached to % (expected 87)', v_sophie;
  END IF;

  SELECT count(*) INTO v_names FROM contacts
   WHERE first_name LIKE '%@%' OR coalesce(trim(last_name), '') = '';
  IF v_names > 0 THEN
    RAISE NOTICE 'contacts still carrying a non-name in a name column: %', v_names;
  END IF;

  RAISE NOTICE 'historical chat backfill: 13 recorded at contact level, 0 tasks, 0 pipeline effects';
END $$;

COMMIT;
