import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  ClipboardList,
  Contact,
  Handshake,
  Home,
  LayoutGrid,
  ListTodo,
  MoreHorizontal,
  Settings,
  Users,
} from "lucide-react";
import { useTranslate } from "ra-core";
import { Link, matchPath, useLocation } from "react-router";

// Primary mobile bottom nav (routing/shell regression fix, Programs +
// Opportunity UX slice): reuses Atomic's existing bottom-bar shell — no new
// nav architecture — but points at the real CRM sections (Opportunities,
// Programs, Clients) instead of the original scaffold's Contacts/Tasks/+.
// The remaining sections (Applications, Contacts, Tasks, Settings) live
// under "More" rather than crowding five bars into one row. No Companies,
// no dead Cohorts list link, no generic create action (each destination's
// own list page carries its own create button — see ContactList.tsx /
// MobileTasksList.tsx).
const MORE_PATHS = ["/applications", "/contacts", "/tasks", "/settings"];

export const MobileNavigation = () => {
  const location = useLocation();
  const translate = useTranslate();

  let currentPath: string | boolean = "/";
  if (matchPath("/", location.pathname)) {
    currentPath = "/";
  } else if (matchPath("/deals/*", location.pathname)) {
    currentPath = "/deals";
  } else if (matchPath("/programs/*", location.pathname)) {
    currentPath = "/programs";
  } else if (matchPath("/enrollments/*", location.pathname)) {
    currentPath = "/enrollments";
  } else if (
    MORE_PATHS.some((path) => matchPath(`${path}/*`, location.pathname))
  ) {
    currentPath = "/more";
  } else {
    currentPath = false;
  }

  // Check if the app is running as a PWA (standalone mode)
  const isPwa = window.matchMedia("(display-mode: standalone)").matches;
  // Check if it's iOS on the web
  const isWebiOS = /iPad|iPod|iPhone/.test(window.navigator.userAgent);

  return (
    <nav
      aria-label={translate("crm.navigation.label")}
      className="fixed bottom-0 left-0 right-0 z-50 bg-secondary h-14"
      style={{
        // iOS bug: even though viewport is set correctly, the bottom safe area inset is not accounted for
        // So we manually add some padding to avoid the navigation being too close to the home bar
        paddingBottom: isPwa && isWebiOS ? 15 : undefined,
        // We use box-sizing: border-box, so the height contains the padding.
        // To actually increase the padding, we need to increase the height as well
        height:
          "calc(var(--spacing)) * 6" + (isPwa && isWebiOS ? " + 15px" : ""),
      }}
    >
      <div className="flex justify-center">
        <NavigationButton
          href="/"
          Icon={Home}
          label={translate("ra.page.dashboard")}
          isActive={currentPath === "/"}
        />
        <NavigationButton
          href="/deals"
          Icon={Handshake}
          label={translate("crm.navigation.pipeline")}
          isActive={currentPath === "/deals"}
        />
        <NavigationButton
          href="/programs"
          Icon={LayoutGrid}
          label={translate("crm.programs.name", { _: "Programs" })}
          isActive={currentPath === "/programs"}
        />
        <NavigationButton
          href="/enrollments"
          Icon={Users}
          label={translate("resources.enrollments.name", { smart_count: 2 })}
          isActive={currentPath === "/enrollments"}
        />
        <MoreButton isActive={currentPath === "/more"} />
      </div>
    </nav>
  );
};

const NavigationButton = ({
  href,
  Icon,
  label,
  isActive,
}: {
  href: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  isActive: boolean;
}) => (
  <Button
    asChild
    variant="ghost"
    className={cn(
      "flex-col gap-1 h-auto py-2 px-1 rounded-md w-16",
      isActive ? null : "text-muted-foreground",
    )}
  >
    <Link to={href}>
      <Icon className="size-6" />
      <span className="text-[0.6rem] font-medium">{label}</span>
    </Link>
  </Button>
);

const MoreButton = ({ isActive }: { isActive: boolean }) => {
  const translate = useTranslate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "flex-col gap-1 h-auto py-2 px-1 rounded-md w-16",
            isActive ? null : "text-muted-foreground",
          )}
        >
          <MoreHorizontal className="size-6" />
          <span className="text-[0.6rem] font-medium">
            {translate("crm.navigation.more", { _: "More" })}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top">
        <DropdownMenuItem asChild>
          <Link to="/applications" className="flex items-center gap-2">
            <ClipboardList className="size-4" />
            {translate("resources.applications.name", { smart_count: 2 })}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/contacts" className="flex items-center gap-2">
            <Contact className="size-4" />
            {translate("resources.contacts.name", { smart_count: 2 })}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/tasks" className="flex items-center gap-2">
            <ListTodo className="size-4" />
            {translate("resources.tasks.name", { smart_count: 2 })}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/settings" className="flex items-center gap-2">
            <Settings className="size-4" />
            {translate("crm.settings.title")}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
