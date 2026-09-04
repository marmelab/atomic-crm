-- Stripe test-mode integration slice.
-- Hand-authored (no local Docker/Supabase available this session).
-- Mirrors supabase/schemas/01_tables.sql exactly.
--
-- The minimal identifiers needed to observe and safely re-enter the
-- payment/schedule-adoption sequence — never raw card/bank/payment-method
-- data. See each column's own schema comment for the exact rationale.

ALTER TABLE "public"."contacts"
    ADD COLUMN "stripe_customer_id" "text";

ALTER TABLE "public"."deals"
    ADD COLUMN "stripe_checkout_session_id" "text",
    ADD COLUMN "stripe_subscription_id" "text",
    ADD COLUMN "stripe_subscription_schedule_id" "text";

CREATE UNIQUE INDEX "deals_stripe_subscription_id_idx" ON "public"."deals" USING "btree" ("stripe_subscription_id") WHERE ("stripe_subscription_id" IS NOT NULL);
CREATE UNIQUE INDEX "deals_stripe_subscription_schedule_id_idx" ON "public"."deals" USING "btree" ("stripe_subscription_schedule_id") WHERE ("stripe_subscription_schedule_id" IS NOT NULL);
CREATE UNIQUE INDEX "contacts_stripe_customer_id_idx" ON "public"."contacts" USING "btree" ("stripe_customer_id") WHERE ("stripe_customer_id" IS NOT NULL);
