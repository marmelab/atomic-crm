import { useTranslate } from "ra-core";

import MobileHeader from "../layout/MobileHeader";
import { MobileContent } from "../layout/MobileContent";
import { Dashboard } from "./Dashboard";

// Chaos Monkey routing/shell regression fix (Programs + Opportunity UX
// slice): this used to render only DashboardActivityLog — a leftover from
// before the Dashboard/Today slice, which only ever rebuilt the desktop
// branch. At any viewport narrow enough to use the Mobile shell (see
// hooks/use-mobile.ts), "/#/" showed just a "Latest Activity" fragment
// instead of the real Dashboard. Per explicit human acceptance direction:
// every viewport renders the SAME Dashboard (Tasks, Business at a Glance,
// People Deciding, Art Oracle, Latest Activity) — only the mobile chrome
// (header, bottom nav) differs. Dashboard.tsx's own responsive classes
// (grid-cols-1 at narrow widths) handle the stacking; no separate mobile
// dashboard content exists anymore.
const Wrapper = ({ children }: { children: React.ReactNode }) => {
  const translate = useTranslate();
  return (
    <>
      <MobileHeader>
        <div className="text-secondary-foreground no-underline font-semibold tracking-tight">
          {translate("crm.header.wordmark")}
        </div>
      </MobileHeader>
      <MobileContent>{children}</MobileContent>
    </>
  );
};

export const MobileDashboard = () => (
  <Wrapper>
    <Dashboard />
  </Wrapper>
);
