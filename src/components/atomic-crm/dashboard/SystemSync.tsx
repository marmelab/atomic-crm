import { SyncCalendarButton } from "../capacity/SyncCalendarButton";
import { SyncAllStripeButton } from "../deals/SyncAllStripeButton";
import { useSessionWeeks } from "../capacity/useSessionWeeks";
import { useLivingExampleCapacityData } from "./useLivingExampleCapacityData";

// The two manual refreshes, where Leif actually stands.
//
// Just the controls. This was a card once — heading, explanatory
// paragraph, a "56 1:1 weeks in Year Tracking" line — and it pushed the
// work down the page to explain two buttons that are already labelled.
// What is left is what he uses. The result of pressing either one is a
// toast, which is where transient feedback belongs.
//
// Neither action is reimplemented here: Sync Calendar is literally the
// same component the 1:1 Program page renders, and Sync Stripe reaches the
// same sweep pg_cron runs. One canonical action each, one result message,
// one refresh, so the two entry points cannot drift.
//
// Sync Stripe reaches that sweep through its own door. The cron endpoint
// was not widened to get here: it still takes the cron secret and nothing
// else, because "nobody signed in from a browser gets to walk every Stripe
// customer" is a rule worth keeping. Instead the browser asks, and the
// Edge Function decides by reading the caller's own `sales` row with the
// service role and requiring `administrator`. No secret reaches the
// browser, the request carries no parameters to steer, and the answer is
// counts rather than Stripe records.
export const SystemSync = () => {
  const { offer } = useLivingExampleCapacityData();
  const { lastSyncedAt } = useSessionWeeks(offer?.id);

  return (
    <div className="flex items-center gap-2 shrink-0">
      <SyncAllStripeButton />
      {/* Keeps its own subtle "Last synced" line — it is the one piece of
          metadata that tells Leif whether pressing it again is worth it. */}
      <SyncCalendarButton lastSyncedAt={lastSyncedAt} />
    </div>
  );
};
