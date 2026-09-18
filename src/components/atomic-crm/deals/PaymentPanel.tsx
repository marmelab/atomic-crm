import { useCallback, useEffect, useState } from "react";
import { useDataProvider, useGetOne, useNotify } from "ra-core";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import type { Deal } from "../types";
import { assessPaymentStatus, type PaymentStatus } from "./paymentStatus";
import {
  discoverStripeCustomers,
  linkStripeCustomer,
  syncStripeForContact,
  type DiscoveredStripeCustomer,
} from "./syncStripe";

// Payment, stated plainly and kept distinct from everything else.
//
// The four dimensions — sales outcome, payment, enrollment phase,
// onboarding — are independent, and this panel shows exactly one of them.
// It never says "no payment records" while a known arrangement exists:
// Denise and Ava each had a real scheduled Stripe plan reading as nothing
// for weeks, because the CRM only knew about plans it had created itself.
export const PaymentPanel = ({
  opportunityId,
  contactId,
  title = "Payment",
}: {
  opportunityId: number | string;
  contactId?: number | string | undefined;
  title?: string;
}) => {
  const dataProvider = useDataProvider();

  // Sync Stripe is how a person WITHOUT a verified Stripe customer gets
  // one, so it must never be hidden for lack of one — Sam Milz is exactly
  // that case. It was also hidden whenever the caller's own contact lookup
  // had not resolved, which is why it was missing from his Client page, so
  // the Opportunity's own contact_id is used as the fallback.
  const { data: deal } = useGetOne<Deal>(
    "deals",
    { id: opportunityId },
    { enabled: contactId == null },
  );
  const resolvedContactId = contactId ?? deal?.contact_id;
  const notify = useNotify();
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [candidates, setCandidates] = useState<DiscoveredStripeCustomer[]>([]);
  const [linking, setLinking] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus(await assessPaymentStatus(dataProvider, opportunityId));
  }, [dataProvider, opportunityId]);

  useEffect(() => {
    load();
  }, [load]);

  const sync = async () => {
    if (resolvedContactId == null) return;
    setSyncing(true);
    try {
      const result = await syncStripeForContact(resolvedContactId);
      notify(result.message, {
        type: result.status === "error" ? "warning" : "info",
      });
      await load();

      // Nothing found can mean two different things: this person has no
      // Stripe arrangement, or the CRM has never been told which Stripe
      // customer is theirs. Leif creating a subscription by hand produces
      // the second. Candidates are proposed, never linked automatically.
      if (result.status === "none-found") {
        setCandidates(await discoverStripeCustomers(resolvedContactId));
      } else {
        setCandidates([]);
      }
    } catch {
      notify("Could not reach Stripe just now.", { type: "warning" });
    } finally {
      setSyncing(false);
    }
  };

  // A review must be liftable by the person who did the reviewing, or
  // "needs review" becomes a state nobody can ever leave. Nothing else
  // clears it: the reconciler deliberately never does.
  const markReviewed = async () => {
    setClearing(true);
    try {
      await dataProvider.update("deals", {
        id: opportunityId,
        data: { payment_review_reason: null },
        previousData: { id: opportunityId },
      });
      notify("Payment reviewed.", { type: "info" });
      await load();
    } catch {
      notify("ra.notification.http_error", { type: "error" });
    } finally {
      setClearing(false);
    }
  };

  const link = async (stripeCustomerId: string) => {
    if (resolvedContactId == null) return;
    setLinking(stripeCustomerId);
    try {
      const result = await linkStripeCustomer(
        resolvedContactId,
        stripeCustomerId,
      );
      notify(result.message, {
        type: result.status === "error" ? "warning" : "info",
      });
      if (result.status === "linked") setCandidates([]);
      await load();
    } finally {
      setLinking(null);
    }
  };

  if (!status) return null;

  return (
    <Card className="mt-4">
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">{title}</p>
          {status.stripeLinked && (
            <Badge variant="outline" className="shrink-0">
              Stripe linked
            </Badge>
          )}
        </div>

        <p className="text-base">{status.headline}</p>

        {status.detail.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {status.detail.join(" · ")}
          </p>
        )}

        {status.reviewReason && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 flex flex-col gap-2">
            <p className="text-sm">{status.reviewReason}</p>
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={markReviewed}
                disabled={clearing}
              >
                {clearing ? "Saving…" : "Mark reviewed"}
              </Button>
            </div>
          </div>
        )}

        {status.outstanding && (
          <p className="text-sm">
            <span className="text-xs uppercase tracking-wide text-muted-foreground mr-2">
              Next
            </span>
            {status.outstanding}
          </p>
        )}

        {candidates.length > 0 && (
          <div className="rounded-md border p-2 flex flex-col gap-2">
            <p className="text-sm">
              Stripe has {candidates.length === 1 ? "an account" : "accounts"}{" "}
              under this person's email address. The CRM will not assume{" "}
              {candidates.length === 1 ? "it is" : "they are"} theirs.
            </p>
            {candidates.map((candidate) => (
              <div
                key={candidate.stripeCustomerId}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {candidate.name ?? candidate.email ?? "Stripe customer"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {candidate.liveSubscriptions > 0
                      ? "Live subscription"
                      : candidate.liveSchedules > 0
                        ? "Scheduled plan"
                        : "No live plan"}
                    {candidate.succeededPayments > 0 &&
                      ` · ${candidate.succeededPayments} payment${candidate.succeededPayments === 1 ? "" : "s"}`}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => link(candidate.stripeCustomerId)}
                  disabled={linking != null}
                >
                  {linking === candidate.stripeCustomerId
                    ? "Linking…"
                    : "This is them"}
                </Button>
              </div>
            ))}
          </div>
        )}

        {resolvedContactId != null && (
          <div>
            {/* Reconciles this person only. The browser never sees a Stripe
                key — it calls the authenticated server path, which holds
                the credentials and scopes the work to one customer id. */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={sync}
              disabled={syncing}
            >
              {syncing ? "Syncing…" : "Sync Stripe"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
