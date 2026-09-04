-- Payment domain foundation slice.
-- Hand-authored (no local Docker/Supabase available this session — see
-- this slice's report for the production-verification item this leaves
-- open). Mirrors supabase/schemas/01_tables.sql exactly.
--
-- deals.offer_page_token: the ONLY way the public personalized Offer Page
-- resolves a Deal — opaque and random, never the Deal's own sequential id
-- (which would let one prospect enumerate another's name and frozen
-- price). No "active/expired/superseded" status: there is only ever one
-- current commercial snapshot per Deal (handle_deal_saved() already
-- re-freezes it in place on change), so the same token always reflects
-- whatever is currently authorized.
-- deals.offer_page_opened_at: first time the page was actually opened, if
-- ever — a lightweight signal, not a state machine.
-- enrollments.opportunity_id unique index: at most one Enrollment per
-- Opportunity, enforced at the database level as the race-safe guard
-- against two concurrent successful-payment fulfillments both creating
-- one (recordDealPaymentSucceeded.ts's own read-check is the fast path;
-- this is the actual guarantee).

ALTER TABLE "public"."deals"
    ADD COLUMN "offer_page_token" "text",
    ADD COLUMN "offer_page_opened_at" timestamp with time zone;

CREATE UNIQUE INDEX "deals_offer_page_token_idx" ON "public"."deals" USING "btree" ("offer_page_token") WHERE ("offer_page_token" IS NOT NULL);

CREATE UNIQUE INDEX "enrollments_opportunity_id_idx" ON "public"."enrollments" USING "btree" ("opportunity_id");
