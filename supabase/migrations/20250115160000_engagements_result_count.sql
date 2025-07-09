-- Migration: Rename 'amount' to 'result_count' in 'engagements' table
ALTER TABLE engagements RENAME COLUMN amount TO result_count; 