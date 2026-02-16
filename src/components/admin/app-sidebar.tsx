import { createElement } from "react";
import {
  CanAccess,
  useCanAccess,
  useCreatePath,
  useGetResourceLabel,
  useHasDashboard,
  useResourceDefinitions,
  useTranslate,
} from "ra-core";
import { Link, useMatch } from "react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { House, Import, List, Settings, User } from "lucide-react";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import { ImportPage } from "@/components/atomic-crm/misc/ImportPage";

/**
 * Navigation sidebar displaying menu items, allowing users to navigate between different sections of the application.
 *
 * The sidebar can collapse to an icon-only view and renders as a collapsible drawer on mobile devices.
 * It automatically includes links to the dashboard (if defined) and all list views defined in Resource components.
 *
 * Included in the default Layout component
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/appsidebar AppSidebar documentation}
 * @see {@link https://ui.shadcn.com/docs/components/sidebar shadcn/ui Sidebar component}
 * @see layout.tsx
 */
export function AppSidebar() {
  const hasDashboard = useHasDashboard();
  const resources = useResourceDefinitions();
  const { openMobile, setOpenMobile } = useSidebar();
  const handleClick = () => {
    if (openMobile) {
      setOpenMobile(false);
    }
  };
  const { darkModeLogo, lightModeLogo, title } = useConfigurationContext();
  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="border-b px-4 py-4 group-data-[collapsible=icon]:px-2">
        <Link
          to="/"
          className="flex items-center gap-3 text-foreground no-underline"
        >
          <img
            className="[.light_&]:hidden h-7 w-7 shrink-0 object-contain"
            src={darkModeLogo}
            alt={title}
          />
          <img
            className="[.dark_&]:hidden h-7 w-7 shrink-0 object-contain"
            src={lightModeLogo}
            alt={title}
          />
          <span className="text-lg font-semibold truncate group-data-[collapsible=icon]:hidden">
            {title}
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent className="px-2 py-2">
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {hasDashboard ? (
                <DashboardMenuItem onClick={handleClick} />
              ) : null}
              {Object.keys(resources)
                .filter((name) => resources[name].hasList)
                .map((name) => (
                  <ResourceMenuItem
                    key={name}
                    name={name}
                    onClick={handleClick}
                  />
                ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="px-2 pb-4">
        <SidebarSeparator className="mb-2" />
        <SidebarMenu>
          <FooterMenuItem
            to="/settings"
            icon={<Settings />}
            label="My info"
            onClick={handleClick}
          />
          <CanAccess resource="sales" action="list">
            <FooterMenuItem
              to="/sales"
              icon={<User />}
              label="Users"
              onClick={handleClick}
            />
          </CanAccess>
          <FooterMenuItem
            to={ImportPage.path}
            icon={<Import />}
            label="Import data"
            onClick={handleClick}
          />
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

/**
 * Menu item for the dashboard link in the sidebar.
 */
export const DashboardMenuItem = ({ onClick }: { onClick?: () => void }) => {
  const translate = useTranslate();
  const label = translate("ra.page.dashboard", {
    _: "Dashboard",
  });
  const match = useMatch({ path: "/", end: true });
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={!!match} tooltip="Dashboard">
        <Link to="/" onClick={onClick}>
          <House />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
};

/**
 * Menu item for a resource link in the sidebar.
 */
export const ResourceMenuItem = ({
  name,
  onClick,
}: {
  name: string;
  onClick?: () => void;
}) => {
  const { canAccess, isPending } = useCanAccess({
    resource: name,
    action: "list",
  });
  const resources = useResourceDefinitions();
  const getResourceLabel = useGetResourceLabel();
  const createPath = useCreatePath();
  const to = createPath({
    resource: name,
    type: "list",
  });
  const match = useMatch({ path: to, end: false });
  const label = getResourceLabel(name, 2);

  if (isPending) {
    return <Skeleton className="h-8 w-full" />;
  }

  if (!resources || !resources[name] || !canAccess) return null;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={!!match} tooltip={label}>
        <Link to={to} state={{ _scrollToTop: true }} onClick={onClick}>
          {resources[name].icon ? (
            createElement(resources[name].icon)
          ) : (
            <List />
          )}
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
};

/**
 * Menu item for the sidebar footer (Settings, Users, Import).
 */
const FooterMenuItem = ({
  to,
  icon,
  label,
  onClick,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) => {
  const match = useMatch({ path: to, end: false });
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={!!match} tooltip={label}>
        <Link to={to} onClick={onClick}>
          {icon}
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
};
