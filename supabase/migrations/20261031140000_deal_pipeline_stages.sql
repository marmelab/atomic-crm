-- Deal pipeline rework: "Opportunity / Proposal Sent / In Negotiation / Won /
-- Lost / Delayed" becomes "New / Contacted / Demo / Interested / Not Interested
-- / Proposal / Follow-up / Won".
--
-- deals.stage is a plain text column (no enum, no check constraint), so the
-- stage values can be remapped with simple updates. No deal record, id or
-- relationship is created, deleted or reset.
--
-- Unambiguous mappings:
--   opportunity    -> new          The pipeline entry stage.
--   proposal-sent  -> proposal     Same business meaning, new slug.
--
-- Judgment-call mappings (safe defaults, see the changelog: admin can move
-- individual deals on the Kanban board afterwards):
--   in-negociation -> proposal     Negotiating the send of a proposal sits in
--                                  the Proposal stage of the new pipeline.
--   delayed        -> interested   A postponed but alive deal goes back to the
--                                  Interested stage instead of being treated
--                                  as lost.
--
-- won and lost keep their internal values, so closed-deal reporting
-- (defaultDealPipelineStatuses, dashboards filters stage@neq lost) keeps working.

update public.deals set stage = 'new' where stage = 'opportunity';

update public.deals set stage = 'proposal' where stage = 'proposal-sent';

update public.deals set stage = 'proposal' where stage = 'in-negociation';

update public.deals set stage = 'interested' where stage = 'delayed';
