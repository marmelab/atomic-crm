import { useTranslate } from "ra-core";

import { SyncCalendarButton } from "../capacity/SyncCalendarButton";
import { useSessionWeeks } from "../capacity/useSessionWeeks";
import { useLivingExampleCapacityData } from "./useLivingExampleCapacityData";

// The two manual refreshes, where Leif actually stands.
//
// Both already exist and neither is reimplemented here — this is an entry
// point, not a second implementation. Sync Calendar is literally the same
// component the 1:1 Program page renders, so the two cannot drift: one
// canonical action, one result message, one refresh.
//
// Sync Stripe is deliberately NOT here, and that is a finding rather than
// an omission. The per-contact sweep exists on PaymentPanel and is safe —
// a signed-in user's own JWT, reaching only Stripe customers already
// verified as that Contact's. The WHOLE-account sweep is restricted to
// pg_cron with the cron secret, on purpose: "nobody signed in from a
// browser gets to walk every Stripe customer." Putting it on the Dashboard
// means either shipping that secret to the browser or widening the Edge
// Function so any signed-in session can enumerate the Stripe account.
// Both are security decisions, and they are Leif's to make, not a
// side-effect of adding a button.
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
              _: "Pull the latest 1:1 weeks from Year Tracking and rebuild every client's schedule.",
            })}
          </p>
        </div>
        {/* The same button, the same action, the same refresh. */}
        <SyncCalendarButton lastSyncedAt={lastSyncedAt} />
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
