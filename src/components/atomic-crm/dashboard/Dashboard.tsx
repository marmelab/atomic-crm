import { useGetList } from "ra-core";

import type { Contact } from "../types";
import { DashboardActivityLog } from "./DashboardActivityLog";
import { DealsChart } from "./DealsChart";
import { FilingsDueThisWeek } from "./FilingsDueThisWeek";
import { HotContacts } from "./HotContacts";
import { TaskCompletionStats } from "./TaskCompletionStats";
import { TasksAnalytics } from "./TasksAnalytics";
import { TasksList } from "./TasksList";
import { Welcome } from "./Welcome";

export const Dashboard = () => {
  const { total: totalDeal, isPending: isPendingDeal } = useGetList<Contact>(
    "deals",
    {
      pagination: { page: 1, perPage: 1 },
    },
  );

  if (isPendingDeal) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6 mt-1">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-3">
          <div className="flex flex-col gap-4">
            {import.meta.env.VITE_IS_DEMO === "true" ? <Welcome /> : null}
            <HotContacts />
          </div>
        </div>
        <div className="md:col-span-6">
          <div className="flex flex-col gap-6">
            {totalDeal ? <DealsChart /> : null}
            <DashboardActivityLog />
          </div>
        </div>
        <div className="md:col-span-3">
          <div className="flex flex-col gap-4">
            <TaskCompletionStats />
            <FilingsDueThisWeek />
            <TasksList />
          </div>
        </div>
      </div>

      {/* Full-width task analytics row */}
      <TasksAnalytics />
    </div>
  );
};
