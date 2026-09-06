-- Contracts + Onboarding slice: the real requirement catalog for Leif's two
-- current Offers, per his own architecture-review approval. No admin UI in
-- v1 (same posture as offer_payment_options) — a future requirement is a
-- migration like this one, not a schema change.
insert into public.onboarding_requirement_templates
  (offer_id, key, label, task_text_template, is_required, sort_order)
values
  -- The Living Example (offer_id = 1)
  (1, 'contract', 'Contract signed', 'Send contract to {name}', true, 1),
  (1, 'notion_access', 'Notion access', 'Grant {name} Notion personal session-notes access', true, 2),
  (1, 'curriculum_access', 'Living Example curriculum access', 'Grant {name} Living Example curriculum access', true, 3),
  (1, 'meditation_library_access', 'Meditation library access', 'Grant {name} meditation library access', true, 4),
  -- Growing Yourself Up (offer_id = 2)
  (2, 'contract', 'Contract signed', 'Send contract to {name}', true, 1),
  (2, 'slack_access', 'Slack access', 'Invite {name} to GYU Slack', true, 2),
  (2, 'calendar_access', 'Google Calendar access', 'Grant {name} GYU calendar access', true, 3),
  (2, 'curriculum_access', 'GYU curriculum access', 'Grant {name} GYU curriculum access', true, 4),
  (2, 'meditation_library_access', 'Meditation library access', 'Grant {name} meditation library access', true, 5)
on conflict (offer_id, key) do nothing;
