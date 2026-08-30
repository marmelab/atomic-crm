-- Dashboard/Today slice: adds the Pending/Waiting/Completed/Cancelled task
-- status vocabulary alongside the existing done_date field.
--
-- Backfill: existing tasks with a done_date become 'completed'; everything
-- else defaults to 'pending' (no existing rows can be 'waiting' or
-- 'cancelled' since those states didn't exist before this migration).

ALTER TABLE "public"."tasks"
    ADD COLUMN "status" text NOT NULL DEFAULT 'pending';

UPDATE "public"."tasks"
SET "status" = 'completed'
WHERE "done_date" IS NOT NULL;

ALTER TABLE "public"."tasks"
    ADD CONSTRAINT "tasks_status_check" CHECK (status IN ('pending', 'waiting', 'completed', 'cancelled'));
