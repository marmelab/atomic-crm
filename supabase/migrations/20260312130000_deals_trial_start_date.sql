-- Add trial_start_date to deals table to track when a trial starts for won deals
ALTER TABLE "public"."deals" ADD COLUMN "trial_start_date" date;
