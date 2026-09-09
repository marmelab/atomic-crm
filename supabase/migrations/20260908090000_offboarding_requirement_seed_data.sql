-- Client Offboarding slice: the real requirement catalog for Leif's two
-- current Offers, per his own explicit approval. No admin UI in v1 (same
-- posture as onboarding_requirement_templates) — a future requirement is
-- a migration like this one, not a schema change. Curriculum and
-- meditation-library access are deliberately NOT represented here —
-- current business rules keep those available after completion.
insert into public.offboarding_requirement_templates
  (offer_id, key, label, task_text_template, is_required, sort_order)
values
  -- The Living Example (offer_id = 1)
  (1, 'notes_archived', 'Session notes archived', 'Move {name}''s session notes to Past Clients', true, 1),
  -- Growing Yourself Up (offer_id = 2)
  (2, 'slack_removed', 'Slack access removed', 'Remove {name} from GYU Slack', true, 1),
  (2, 'calendar_removed', 'Google Calendar access removed', 'Remove {name} from GYU Google Calendar', true, 2)
on conflict (offer_id, key) do nothing;
