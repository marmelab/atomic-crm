-- MAIN-ONLY. Two Task sentences, said the way a person reads them.
--
-- Listed in replay-manifest.json: it rewrites the display text of two
-- named production Tasks and owns no schema.
--
-- The calendar sync built its week label by pasting two ISO dates
-- together and stored the result in tasks.text, so Pete's and Jules's
-- Tasks read
--
--   Pete Bassett · No session booked for week of 2026-09-13–2026-09-16
--
-- The generator is fixed (supabase/functions/_shared/cadenceWeekLabel.ts),
-- which settles every Task made from now on. These two were written
-- before that and carry the old sentence in a column, so nothing at
-- render time can improve them.
--
-- Only the words change. The label is DERIVED from each Task's own
-- canonical window — window_end is exclusive, so 2026-09-17 means the
-- week runs to the 16th — and this migration refuses unless that window
-- is exactly what the old sentence already claimed. No due date, status,
-- type, link or cadence issue is touched, and no other Task is read.
--
--   156  Pete Bassett        2026-09-13 → 2026-09-17  ->  Sep 13–16
--   157  Jules Litman-Cleper 2026-06-28 → 2026-07-02  ->  Jun 28–Jul 1

begin;

do $$
declare
  r record;
  v_start date;
  v_end date;
  v_before text;
  v_rows int := 0;
  v_texts_before int;
begin
  select count(*) into v_texts_before from tasks where text ~ '\d{4}-\d{2}-\d{2}';
  if v_texts_before <> 2 then
    raise exception 'expected exactly 2 Tasks carrying an ISO date, found %', v_texts_before;
  end if;

  for r in
    select * from (values
      (156,
       'Pete Bassett · No session booked for week of 2026-09-13–2026-09-16',
       'Pete Bassett · No session booked for week of Sep 13–16',
       date '2026-09-13', date '2026-09-17'),
      (157,
       'Jules Litman-Cleper · No session booked for week of 2026-06-28–2026-07-01',
       'Jules Litman-Cleper · No session booked for week of Jun 28–Jul 1',
       date '2026-06-28', date '2026-07-02')
    ) as t(task_id, old_text, new_text, window_start, window_end)
  loop
    select text into v_before from tasks where id = r.task_id;
    if v_before is distinct from r.old_text then
      raise exception 'Task % no longer says what this repair was written for', r.task_id;
    end if;

    -- The new words must come from the Task's OWN window, not from this
    -- file's opinion of it.
    select s.window_start, s.window_end into v_start, v_end
      from tasks t
      join client_session_cadence_issues i on i.id = t.cadence_issue_id
      join enrollment_expected_sessions s on s.id = i.enrollment_expected_session_id
     where t.id = r.task_id;
    if v_start is distinct from r.window_start or v_end is distinct from r.window_end then
      raise exception 'Task % is linked to window % → %, not % → %',
        r.task_id, v_start, v_end, r.window_start, r.window_end;
    end if;

    update tasks set text = r.new_text where id = r.task_id;
    v_rows := v_rows + 1;
  end loop;

  if v_rows <> 2 then
    raise exception 'expected to reword exactly 2 Tasks, reworded %', v_rows;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Prove only the words moved
-- ---------------------------------------------------------------------
do $$
declare v_n int;
begin
  select count(*) into v_n from tasks where text ~ '\d{4}-\d{2}-\d{2}';
  if v_n <> 0 then
    raise exception 'a Task still says a date in ISO: % left', v_n;
  end if;

  select count(*) into v_n from tasks
   where id in (156, 157)
     and type = 'resolve_client_session_cadence'
     and status = 'completed'
     and done_date is not null
     and due_date::date = date '2026-09-18'
     and cadence_issue_id is not null;
  if v_n <> 2 then
    raise exception 'something other than the words changed on Task 156/157';
  end if;

  -- The cadence issues they belong to are business truth and are not
  -- this migration's business.
  select count(*) into v_n from client_session_cadence_issues
   where id in (3, 4) and classification = 'known_skip' and resolved_at is not null;
  if v_n <> 2 then
    raise exception 'a cadence issue changed, and nothing here should have changed one';
  end if;

  if (select count(*) from tasks) <> 23 then
    raise exception 'the number of Tasks changed';
  end if;
end $$;

commit;
