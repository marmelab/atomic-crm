import { useGetList } from "ra-core";

import { MobileHeader } from "../layout/MobileHeader";
import type { Contact, ContactNote } from "../types";
import { DashboardActivityLog } from "./DashboardActivityLog";
import { DashboardStepper } from "./DashboardStepper";
import { Welcome } from "./Welcome";

export const MobileDashboard = () => {
  const {
    data: dataContact,
    total: totalContact,
    isPending: isPendingContact,
  } = useGetList<Contact>("contacts", {
    pagination: { page: 1, perPage: 1 },
  });

  const { total: totalContactNotes, isPending: isPendingContactNotes } =
    useGetList<ContactNote>("contactNotes", {
      pagination: { page: 1, perPage: 1 },
    });

  const isPending = isPendingContact || isPendingContactNotes;

  if (isPending) {
    return null;
  }

  if (!totalContact) {
    return (
      <>
        <MobileHeader />
        <DashboardStepper step={1} />
      </>
    );
  }

  if (!totalContactNotes) {
    return (
      <>
        <MobileHeader />
        <DashboardStepper step={2} contactId={dataContact?.[0]?.id} />
      </>
    );
  }

  return (
    <>
      <MobileHeader />
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mt-1">
        {import.meta.env.VITE_IS_DEMO === "true" ? <Welcome /> : null}
        <DashboardActivityLog />
      </div>
    </>
  );
};
