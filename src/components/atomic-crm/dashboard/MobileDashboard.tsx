import MobileHeader from "../layout/MobileHeader";
import { MobileContent } from "../layout/MobileContent";
import { useConfigurationContext } from "../root/ConfigurationContext";
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
  const { darkModeLogo, lightModeLogo, title } = useConfigurationContext();
  return (
    <>
      <MobileHeader>
        <div className="flex items-center gap-2 text-secondary-foreground no-underline py-3">
          <img
            className="[.light_&]:hidden h-9 w-9"
            src={darkModeLogo}
            alt={title}
          />
          <img
            className="[.dark_&]:hidden h-9 w-9"
            src={lightModeLogo}
            alt={title}
          />
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
