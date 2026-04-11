-- Agency CRM Redesign: Remap legacy deal stage values to new 5-stage pipeline
-- Old: lead, qualified, audit-scheduled, proposal-sent, won, lost
-- New: discovery, solutions-mapping, proposal-under-review, won, lost

UPDATE public.deals SET stage = 'discovery' WHERE stage = 'lead';
UPDATE public.deals SET stage = 'solutions-mapping' WHERE stage = 'qualified';
UPDATE public.deals SET stage = 'solutions-mapping' WHERE stage = 'audit-scheduled';
UPDATE public.deals SET stage = 'proposal-under-review' WHERE stage = 'proposal-sent';
-- 'won' and 'lost' remain unchanged
