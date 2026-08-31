import { useGetList, useTranslate } from "ra-core";

import type { Contact, ContactNote } from "../types";
import { ArtOracleCard } from "./artOracle/ArtOracleCard";
import { BusinessAtAGlance } from "./BusinessAtAGlance";
import { ComingUp } from "./ComingUp";
import { DashboardActivityLog } from "./DashboardActivityLog";
import { DashboardStepper } from "./DashboardStepper";
import { DashboardTasks } from "./DashboardTasks";
import { PeopleDeciding } from "./PeopleDeciding";

// Leif's daily command center: "If Today is clear, sales work is handled."
// Hierarchy is Tasks (Needs Attention) > Coming Up (Next Up slice: non-Task
// business events in time order) > Business capacity > People Deciding /
// Art Oracle > Latest Activity (collapsed) — see the Dashboard/Today slice
// report, extended by the Next Up / Temporal Intelligence slice report.
export const Dashboard = () => {
  const translate = useTranslate();
  const {
    data: dataContact,
    total: totalContact,
    isPending: isPendingContact,
  } = useGetList<Contact>("contacts", {
    pagination: { page: 1, perPage: 1 },
  });

  const { total: totalContactNotes, isPending: isPendingContactNotes } =
    useGetList<ContactNote>("contact_notes", {
      pagination: { page: 1, perPage: 1 },
    });

  const isPending = isPendingContact || isPendingContactNotes;

  if (isPending) {
    return null;
  }

  if (!totalContact) {
    return <DashboardStepper step={1} />;
  }

  if (!totalContactNotes) {
    return <DashboardStepper step={2} contactId={dataContact?.[0]?.id} />;
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
