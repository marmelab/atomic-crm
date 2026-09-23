import { useTranslate } from "ra-core";

import { SyncCalendarButton } from "../capacity/SyncCalendarButton";
import { SyncAllStripeButton } from "../deals/SyncAllStripeButton";
import { useSessionWeeks } from "../capacity/useSessionWeeks";
import { useLivingExampleCapacityData } from "./useLivingExampleCapacityData";

// The two manual refreshes, where Leif actually stands.
//
// Both already exist and neither is reimplemented here — this is an entry
// point, not a second implementation. Sync Calendar is literally the same
// component the 1:1 Program page renders, so the two cannot drift: one
// canonical action, one result message, one refresh.
//
// Sync Stripe reaches the same sweep pg_cron runs hourly, through its own
// door. The cron endpoint was not widened to get here: it still takes the
// cron secret and nothing else, because "nobody signed in from a browser
// gets to walk every Stripe customer" is a rule worth keeping. Instead the
// browser asks, and the Edge Function decides by reading the caller's own
// `sales` row with the service role and requiring `administrator` — the
// same boundary that already guards user management. No secret reaches the
// browser, the request carries no parameters to steer, and the answer is
// counts rather than Stripe records.
export const SystemSync = () => {
  const translate = useTranslate();
  const { offer } = useLivingExampleCapacityData();
  const { lastSyncedAt, weeks } = useSessionWeeks(offer?.id);

  return (
    <section className="rounded-lg border p-4 flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">
            {translate("crm.dashboard.system_sync", { _: "System sync" })}
          </h2>
          <p className="text-xs text-muted-foreground">
            {translate("crm.dashboard.system_sync_hint", {
              _: "Pull the latest 1:1 weeks from Year Tracking and rebuild every client's schedule, or re-read payments from Stripe.",
            })}
          </p>
        </div>
        {/* The same buttons, the same actions, the same refresh. */}
        <div className="flex items-start gap-2">
          <SyncAllStripeButton />
          <SyncCalendarButton lastSyncedAt={lastSyncedAt} />
        </div>
      </div>
      {weeks.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {translate("crm.dashboard.system_sync_weeks", {
            _: "%{count} 1:1 week in Year Tracking |||| %{count} 1:1 weeks in Year Tracking",
            smart_count: weeks.length,
            count: weeks.length,
          })}
        </p>
      )}
    </section>
  );
};
