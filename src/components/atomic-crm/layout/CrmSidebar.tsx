import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Handshake,
  LayoutDashboard,
  Settings,
  Users,
  UsersRound,
} from "lucide-react";
import { CanAccess, useTranslate } from "ra-core";
import { Link, matchPath, useLocation } from "react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

import { useConfigurationContext } from "../root/ConfigurationContext";

export const CrmSidebar = () => {
  const { darkModeLogo, lightModeLogo, title } = useConfigurationContext();
  const translate = useTranslate();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-14 justify-center border-b">
        <Link
          to="/"
          className="flex items-center gap-2 px-2 text-sidebar-foreground no-underline"
        >
          <img
            className="[.light_&]:hidden h-6 shrink-0"
            src={darkModeLogo}
            alt={title}
          />
          <img
            className="[.dark_&]:hidden h-6 shrink-0"
            src={lightModeLogo}
            alt={title}
          />
          <span className="truncate text-base font-semibold text-foreground group-data-[collapsible=icon]:hidden">
            {title}
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavItem
                to="/"
                pattern="/"
                icon={LayoutDashboard}
                label={translate("ra.page.dashboard")}
              />
              <NavItem
                to="/contacts"
                pattern="/contacts/*"
                icon={UsersRound}
                label={translate("resources.contacts.name", { smart_count: 2 })}
              />
              <NavItem
                to="/companies"
                pattern="/companies/*"
                icon={Building2}
                label={translate("resources.companies.name", {
                  smart_count: 2,
                })}
              />
              <NavItem
                to="/deals"
                pattern="/deals/*"
                icon={Handshake}
                label={translate("resources.deals.name", { smart_count: 2 })}
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <AdminGroup />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
};

const AdminGroup = () => {
  const translate = useTranslate();
  return (
    <SidebarGroup className="mt-auto">
      <SidebarGroupLabel>{translate("crm.sidebar.admin")}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <CanAccess resource="sales" action="list">
            <NavItem
              to="/sales"
              pattern="/sales/*"
              icon={Users}
              label={translate("resources.sales.name", { smart_count: 2 })}
            />
          </CanAccess>
          <CanAccess resource="configuration" action="edit">
            <NavItem
              to="/settings"
              pattern="/settings"
              icon={Settings}
              label={translate("crm.settings.title")}
            />
          </CanAccess>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
};

const NavItem = ({
  to,
  pattern,
  icon: Icon,
  label,
}: {
  to: string;
  pattern: string;
  icon: LucideIcon;
  label: string;
}) => {
  const location = useLocation();
  const isActive = !!matchPath(pattern, location.pathname);
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        tooltip={label}
        render={<Link to={to} />}
        className="font-medium"
      >
        <Icon />
        <span>{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
};
