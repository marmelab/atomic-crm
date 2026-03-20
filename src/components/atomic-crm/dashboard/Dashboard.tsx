import { useGetList } from "ra-core";

import type { Contact, ContactNote } from "../types";
import { useGoogleConnectionStatus } from "../google/useGoogleConnectionStatus";
import { ActiveDeals } from "./ActiveDeals";
import { DashboardActivityLog } from "./DashboardActivityLog";
import { DashboardStepper } from "./DashboardStepper";
import { DealsChart } from "./DealsChart";
import { HotContacts } from "./HotContacts";
import { KPICards } from "./KPICards";
import { NoshoAIAssist } from "./NoshoAIAssist";
import { TasksList } from "./TasksList";
import { UpcomingCalendarEvents } from "./UpcomingCalendarEvents";
import { Welcome } from "./Welcome";

export const Dashboard = () => {
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

  const { total: totalDeal, isPending: isPendingDeal } = useGetList<Contact>(
    "deals",
    {
      pagination: { page: 1, perPage: 1 },
    },
  );

  // Must be called before any early return (React hooks rules)
  const { data: googleStatus } = useGoogleConnectionStatus();
  const showCalendar =
    googleStatus?.connected && googleStatus.preferences?.showCalendarOnDashboard;

  const isPending = isPendingContact || isPendingContactNotes || isPendingDeal;

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
    <div className="flex flex-col gap-5 mt-1 pb-6">
      {/* Welcome banner (demo only) */}
      {import.meta.env.VITE_IS_DEMO === "true" ? <Welcome /> : null}

      {/* Row 1: KPI Cards */}
      <KPICards />

      {/* Row 2: Revenue Chart + Calendar + Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className={showCalendar ? "lg:col-span-6" : "lg:col-span-8"}>
          {totalDeal ? <DealsChart /> : null}
        </div>
        {showCalendar && (
          <div className="lg:col-span-3">
            <UpcomingCalendarEvents />
          </div>
        )}
        <div className={showCalendar ? "lg:col-span-3" : "lg:col-span-4"}>
          <TasksList />
        </div>
      </div>

      {/* Row 3: Hot Contacts + Active Deals + Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-3">
          <div className="flex flex-col gap-5">
            <HotContacts />
            <NoshoAIAssist />
          </div>
        </div>
        <div className="lg:col-span-4">
          <ActiveDeals />
        </div>
        <div className="lg:col-span-5">
          <DashboardActivityLog />
        </div>
      </div>
    </div>
  );
};
