import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Cable,
  CheckSquare,
  Handshake,
  House,
  Inbox,
  Settings,
  UserCog,
  Users,
} from "lucide-react";
import { CanAccess, useGetIdentity, useTranslate } from "ra-core";
import { Link, useMatch } from "react-router";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  useSidebar,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const { darkModeLogo, title } = useConfigurationContext();
  const { data: identity } = useGetIdentity();
  const { openMobile, setOpenMobile } = useSidebar();
  const translate = useTranslate();

  const handleClick = () => {
    if (openMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              className="h-auto py-2 data-[slot=sidebar-menu-button]:!p-2"
            >
              <Link to="/" onClick={handleClick}>
                <img
                  className="h-8 w-auto shrink-0 rounded-sm object-contain"
                  src={darkModeLogo}
                  alt={title}
                />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="px-2 py-3">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavMenuItem
                icon={House}
                label={translate("ra.page.dashboard", { _: "Dashboard" })}
                to="/"
                onClick={handleClick}
                end
              />
              <NavMenuItem
                icon={Inbox}
                label={translate("resources.intake_leads.name", { smart_count: 2, _: "Intake" })}
                to="/intake_leads"
                onClick={handleClick}
              />
              <NavMenuItem
                icon={Handshake}
                label={translate("resources.deals.name", { smart_count: 2, _: "Deals" })}
                to="/deals"
                onClick={handleClick}
              />
              <NavMenuItem
                icon={Users}
                label={translate("resources.contacts.name", { smart_count: 2, _: "Contacts" })}
                to="/contacts"
                onClick={handleClick}
              />
              <NavMenuItem
                icon={Building2}
                label={translate("resources.companies.name", { smart_count: 2, _: "Companies" })}
                to="/companies"
                onClick={handleClick}
              />
              <NavMenuItem
                icon={CheckSquare}
                label={translate("resources.tasks.name", { smart_count: 2, _: "Tasks" })}
                to="/tasks"
                onClick={handleClick}
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel>{translate("crm.sidebar.administration", { _: "Administration" })}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <CanAccess resource="sales" action="list">
                <NavMenuItem
                  icon={UserCog}
                  label={translate("resources.sales.name", { smart_count: 2, _: "Sales" })}
                  to="/sales"
                  onClick={handleClick}
                />
              </CanAccess>
              <CanAccess resource="integration_log" action="list">
                <NavMenuItem
                  icon={Cable}
                  label={translate("resources.integration_log.name", { smart_count: 2, _: "Integration Log" })}
                  to="/integration_log"
                  onClick={handleClick}
                />
              </CanAccess>
              <CanAccess resource="configuration" action="edit">
                <NavMenuItem
                  icon={Settings}
                  label={translate("crm.settings.title", { _: "Settings" })}
                  to="/settings"
                  onClick={handleClick}
                />
              </CanAccess>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 overflow-hidden rounded-md border border-sidebar-border bg-sidebar-accent/40 px-2.5 py-2 text-sidebar-foreground">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarImage src={identity?.avatar} role="presentation" />
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground">
              {identity?.fullName?.charAt(0) ?? "U"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-medium">
              {identity?.fullName ?? "User"}
            </p>
            <p className="truncate text-xs text-sidebar-foreground/70">
              Signed in
            </p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

const NavMenuItem = ({
  icon: Icon,
  label,
  to,
  onClick,
  end = false,
}: {
  icon: LucideIcon;
  label: string;
  to: string;
  onClick?: () => void;
  end?: boolean;
}) => {
  const match = useMatch({ path: to, end });

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={!!match} tooltip={label}>
        <Link to={to} onClick={onClick}>
          <Icon />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
};
