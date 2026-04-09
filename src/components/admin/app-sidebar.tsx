import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Cable,
  Handshake,
  House,
  Settings,
  UserCog,
  Users,
} from "lucide-react";
import { CanAccess, useGetIdentity } from "ra-core";
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
  const { darkModeLogo } = useConfigurationContext();
  const { data: identity } = useGetIdentity();
  const { openMobile, setOpenMobile } = useSidebar();

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
                  alt="Hatch CRM"
                />
                <span className="text-base font-semibold text-sidebar-foreground">
                  Hatch CRM
                </span>
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
                label="Dashboard"
                to="/"
                onClick={handleClick}
                end
              />
              <NavMenuItem
                icon={Handshake}
                label="Deals"
                to="/deals"
                onClick={handleClick}
              />
              <NavMenuItem
                icon={Users}
                label="Contacts"
                to="/contacts"
                onClick={handleClick}
              />
              <NavMenuItem
                icon={Building2}
                label="Companies"
                to="/companies"
                onClick={handleClick}
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel>Administration</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <CanAccess resource="sales" action="list">
                <NavMenuItem
                  icon={UserCog}
                  label="Sales"
                  to="/sales"
                  onClick={handleClick}
                />
              </CanAccess>
              <NavMenuItem
                icon={Cable}
                label="Integration Log"
                to="/integration_log"
                onClick={handleClick}
              />
              <CanAccess resource="configuration" action="edit">
                <NavMenuItem
                  icon={Settings}
                  label="Settings"
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
