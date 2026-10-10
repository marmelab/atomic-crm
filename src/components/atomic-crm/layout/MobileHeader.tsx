import { GlobalSearchButton } from "../search";
import { MobileRefreshButton } from "./MobileRefreshButton";

// The search lives here rather than in each screen: there is no Cmd+K on a
// phone, so this header is the only place reachable from every mobile page.
// Refresh only earns its space on the list pages, whose content changes under
// the user; elsewhere it would just crowd the header.
const MobileHeader = ({
  children,
  showRefresh = false,
}: {
  children: React.ReactNode;
  showRefresh?: boolean;
}) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-10 bg-secondary h-14 px-4 w-full flex justify-between items-center">
      {children}
      <div className="flex items-center">
        <GlobalSearchButton variant="icon" />
        {showRefresh ? <MobileRefreshButton /> : null}
      </div>
    </header>
  );
};

export default MobileHeader;
