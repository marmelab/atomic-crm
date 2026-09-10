import { useTranslate } from "ra-core";

import { ArtOracleCard } from "./artOracle/ArtOracleCard";
import { BusinessAtAGlance } from "./BusinessAtAGlance";
import { ComingUp } from "./ComingUp";
import { CompletedTodayTasks } from "./CompletedTodayTasks";
import { DashboardActivityLog } from "./DashboardActivityLog";
import { DashboardTasks } from "./DashboardTasks";
import { NeedsOnboarding } from "./NeedsOnboarding";
import { OutstandingScholarshipReservations } from "./OutstandingScholarshipReservations";
import { PeopleDeciding } from "./PeopleDeciding";

// Leif's daily command center: "If Today is clear, sales work is handled."
// Hierarchy is Tasks (Needs Attention) > Coming Up (Next Up slice: non-Task
// business events in time order) > Business capacity > People Deciding /
// Art Oracle > Latest Activity (collapsed) — see the Dashboard/Today slice
// report, extended by the Next Up / Temporal Intelligence slice report.
//
// Onboarding-gate real-infrastructure repair, round 2: this used to gate on
// "at least one Contact exists" (round 1 removed a stricter Contact-Note
// requirement — see git history) before showing any of the above. Real
// human acceptance testing exposed that this was still wrong: after
// disposable test data was cleaned up and the real CRM returned to zero
// Contacts, the stock "What's next? / Install Atomic CRM / Add your first
// contact" stepper reappeared for Leif's own already-initialized account.
// CRM initialization is NOT a function of business-data counts — this
// app's auth flow already has its own, independent "is initialized" check
// (see authProvider.ts's getIsInitialized/init_state, backed by the
// `sales` table, i.e. "does an administrator account exist" — nothing to
// do with Contacts) that already ran, successfully, before this component
// can even render. An authenticated administrator with zero Contacts is
// still using a fully initialized CRM; zero Contacts is just the CRM's
// current (legitimate) state, not evidence it was never set up. So there
// is no gate here at all: every section below already renders a sane empty
// state on its own (confirmed for each: DashboardTasks, ComingUp,
// PeopleDeciding all render an explicit "nothing here" message;
// CompletedTodayTasks/BusinessAtAGlance/DashboardActivityLog/ArtOracleCard
// are unaffected by, or independently handle, zero business data).
export const Dashboard = () => {
  const translate = useTranslate();

  return (
    <div className="flex flex-col gap-8 mt-1">
      <div>
        <h1 className="text-2xl font-semibold">
          {translate("ra.page.dashboard")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {translate("crm.dashboard.orientation", {
            _: "What needs your attention, and how full is your business?",
          })}
        </p>
      </div>

      <DashboardTasks />

      <CompletedTodayTasks />

      <NeedsOnboarding />

      <OutstandingScholarshipReservations />

      <ComingUp />

      <BusinessAtAGlance />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <PeopleDeciding />
        <ArtOracleCard />
      </div>

      <DashboardActivityLog />
    </div>
  );
};
