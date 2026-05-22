import { useGetList } from "ra-core";

import type { Contact, ContactNote } from "../types";
import { CallStatsWidget } from "./CallStatsWidget";
import { DashboardActivityLog } from "./DashboardActivityLog";
import { DashboardStepper } from "./DashboardStepper";
import { DealStageFunnel } from "./DealStageFunnel";
import { DealsChart } from "./DealsChart";
import { FollowUpsDueToday } from "./FollowUpsDueToday";
import { KpiSummaryRow } from "./KpiSummaryRow";
import { LeadsMissingNextStep } from "./LeadsMissingNextStep";
import { RevenueGoalsTracker } from "./RevenueGoalsTracker";
import { RevenueTrendChart } from "./RevenueTrendChart";
import { SalesTrackingWidget } from "./SalesTrackingWidget";
import { TasksList } from "./TasksList";
import { UpcomingMeetings } from "./UpcomingMeetings";
import { Welcome } from "./Welcome";
import { WidgetErrorBoundary } from "./WidgetErrorBoundary";

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
    <div className="flex flex-col gap-6 mt-1">
      {import.meta.env.VITE_IS_DEMO === "true" ? <Welcome /> : null}

      {totalDeal ? (
        <WidgetErrorBoundary>
          <KpiSummaryRow />
        </WidgetErrorBoundary>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-8">
          <div className="flex flex-col gap-6">
            {totalDeal ? (
              <>
                <WidgetErrorBoundary>
                  <RevenueTrendChart />
                </WidgetErrorBoundary>
                <WidgetErrorBoundary>
                  <DealsChart />
                </WidgetErrorBoundary>
                <WidgetErrorBoundary>
                  <DealStageFunnel />
                </WidgetErrorBoundary>
              </>
            ) : null}
            <WidgetErrorBoundary>
              <SalesTrackingWidget />
            </WidgetErrorBoundary>
            <WidgetErrorBoundary>
              <CallStatsWidget />
            </WidgetErrorBoundary>
            <WidgetErrorBoundary>
              <DashboardActivityLog />
            </WidgetErrorBoundary>
          </div>
        </div>

        <div className="md:col-span-4">
          <div className="flex flex-col gap-4">
            <WidgetErrorBoundary>
              <RevenueGoalsTracker />
            </WidgetErrorBoundary>
            <WidgetErrorBoundary>
              <FollowUpsDueToday />
            </WidgetErrorBoundary>
            <WidgetErrorBoundary>
              <LeadsMissingNextStep />
            </WidgetErrorBoundary>
            <WidgetErrorBoundary>
              <UpcomingMeetings />
            </WidgetErrorBoundary>
            <WidgetErrorBoundary>
              <TasksList />
            </WidgetErrorBoundary>
          </div>
        </div>
      </div>
    </div>
  );
};
