import { useGetList, useTranslate } from "ra-core";

import type { Contact } from "../types";
import { ArtOracleCard } from "./artOracle/ArtOracleCard";
import { BusinessAtAGlance } from "./BusinessAtAGlance";
import { ComingUp } from "./ComingUp";
import { CompletedTodayTasks } from "./CompletedTodayTasks";
import { DashboardActivityLog } from "./DashboardActivityLog";
import { DashboardStepper } from "./DashboardStepper";
import { DashboardTasks } from "./DashboardTasks";
import { PeopleDeciding } from "./PeopleDeciding";

// Leif's daily command center: "If Today is clear, sales work is handled."
// Hierarchy is Tasks (Needs Attention) > Coming Up (Next Up slice: non-Task
// business events in time order) > Business capacity > People Deciding /
// Art Oracle > Latest Activity (collapsed) — see the Dashboard/Today slice
// report, extended by the Next Up / Temporal Intelligence slice report.
//
// Onboarding-gate real-infrastructure repair: this used to ALSO require at
// least one Contact Note (DashboardStepper step 2, "Add your first note")
// before showing any of the above at all. That's stock starter-template
// onboarding, written when every Contact necessarily arrived through a
// human manually using the CRM. The Native Application Intake path (real-
// infrastructure verification slice) proved this false in production: a
// real prospect applying through the public form creates a Contact/Deal/
// Application/Task automatically, but never a Contact Note — an
// administrator whose very first real data arrives that way (exactly
// Leif's own real account, confirmed via human Auth acceptance testing)
// was permanently stuck behind "manufacture a note to unlock your own
// CRM," with no legitimate way through it. A real Contact already existing
// is enough evidence the CRM is in real use; requiring a Note specifically
// was arbitrary, not a genuine initialization signal, and never true
// (this app's own auth flow already has its own, separate "is initialized"
// check — see authProvider.ts's getIsInitialized/init_state — which this
// duplicated with a narrower, stricter condition). Step 1 (at least one
// Contact) is kept: a truly empty, fresh install still gets a lightweight
// nudge instead of a confusing blank Dashboard.
export const Dashboard = () => {
  const translate = useTranslate();
  const { total: totalContact, isPending: isPendingContact } =
    useGetList<Contact>("contacts", {
      pagination: { page: 1, perPage: 1 },
    });

  if (isPendingContact) {
    return null;
  }

  if (!totalContact) {
    return <DashboardStepper step={1} />;
  }

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
