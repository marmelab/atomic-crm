import { useGetList, useTimeout } from "ra-core";
import { Skeleton } from "@/components/ui/skeleton";

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
import MobileHeader from "../layout/MobileHeader";
import { MobileContent } from "../layout/MobileContent";
import { useConfigurationContext } from "../root/ConfigurationContext";

const Wrapper = ({ children }: { children: React.ReactNode }) => {
  const { darkModeLogo, lightModeLogo, title } = useConfigurationContext();
  return (
    <>
      <MobileHeader>
        <div className="flex items-center gap-2 text-secondary-foreground no-underline py-3">
          <img
            className="[.light_&]:hidden h-6"
            src={darkModeLogo}
            alt={title}
          />
          <img
            className="[.dark_&]:hidden h-6"
            src={lightModeLogo}
            alt={title}
          />
          <h1 className="text-xl font-semibold">{title}</h1>
        </div>
      </MobileHeader>
      <MobileContent>{children}</MobileContent>
    </>
  );
};

const Loading = () => (
  <Wrapper>
    <Skeleton className="h-4 w-3/4 mb-4" />
    <Skeleton className="h-4 w-full mb-2" />
    <Skeleton className="h-4 w-full mb-2" />
    <Skeleton className="h-4 w-full mb-2" />
    <Skeleton className="h-4 w-full mb-2" />
  </Wrapper>
);

export const MobileDashboard = () => {
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
  const oneSecondHasPassed = useTimeout(1000);

  const isPending = isPendingContact || isPendingContactNotes || isPendingDeal;

  if (isPending) {
    return oneSecondHasPassed ? <Loading /> : null;
  }

  if (!totalContact) {
    return (
      <Wrapper>
        <DashboardStepper step={1} />
      </Wrapper>
    );
  }

  if (!totalContactNotes) {
    return (
      <Wrapper>
        <DashboardStepper step={2} contactId={dataContact?.[0]?.id} />
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      <div className="flex flex-col gap-4 mt-1">
        {import.meta.env.VITE_IS_DEMO === "true" ? <Welcome /> : null}
        {totalDeal ? (
          <WidgetErrorBoundary>
            <KpiSummaryRow />
          </WidgetErrorBoundary>
        ) : null}
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
        <WidgetErrorBoundary>
          <DashboardActivityLog />
        </WidgetErrorBoundary>
      </div>
    </Wrapper>
  );
};
