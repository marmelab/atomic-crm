import { useGetList } from "ra-core";
import { Card } from "@/components/ui/card";

import type { Contact, ContactNote } from "../types";
import { ActionQueue } from "./ActionQueue";
import { DashboardActivityLog } from "./DashboardActivityLog";
import { DashboardStepper } from "./DashboardStepper";
import { DealsChart } from "./DealsChart";
import { DealsByTradeType } from "./DealsByTradeType";
import { HotContacts } from "./HotContacts";
import { KPICards } from "./KPICards";
import { PipelineSummary } from "./PipelineSummary";
import { StaleDeals } from "./StaleDeals";
import { TasksList } from "./TasksList";

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
    <div className="mt-1 space-y-6">
      <KPICards />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
        <div className="md:col-span-8">
          {totalDeal ? (
            <Card className="p-4">
              <DealsChart />
            </Card>
          ) : null}
        </div>
        <div className="flex flex-col gap-6 md:col-span-4">
          <Card className="p-4">
            <PipelineSummary />
          </Card>
          <DealsByTradeType />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
        <div className="flex flex-col gap-6 md:col-span-8">
          <ActionQueue />
          <StaleDeals />
          <DashboardActivityLog />
        </div>
        <div className="flex flex-col gap-6 md:col-span-4">
          <TasksList />
          <HotContacts />
        </div>
      </div>
    </div>
  );
};
