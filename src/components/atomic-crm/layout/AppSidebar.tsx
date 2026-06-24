import {
  Building2,
  CalendarDays,
  Database,
  FileText,
  Handshake,
  LayoutDashboard,
  Phone,
  Radar,
  Users,
} from "lucide-react";
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
  useSidebar,
} from "@/components/ui/sidebar";

import { useConfigurationContext } from "../root/ConfigurationContext";

type NavItem = {
  label: string;
  to: string;
  /** When true, only matches the exact path (used for the dashboard root). */
  end?: boolean;
  icon: typeof LayoutDashboard;
  /** Extra paths that should also mark this item active. */
  alsoMatch?: string[];
};

type NavSection = {
  label: string;
  items: NavItem[];
};

/**
 * Curated navigation for the CRM, grouped by purpose. Replaces the previous
 * horizontal top-tab navigation with a left sidebar. The route list mirrors the
 * original Header tabs so no destination is lost.
 */
const NAV_SECTIONS: NavSection[] = [
  {
    label: "Översikt",
    items: [
      { label: "Dashboard", to: "/", end: true, icon: LayoutDashboard },
      { label: "Kundradar", to: "/customer-radar", icon: Radar },
      { label: "Ringlista", to: "/call-queue", icon: Phone },
      { label: "Kalender", to: "/calendar", icon: CalendarDays },
    ],
  },
  {
    label: "Sälj",
    items: [
      { label: "Kontakter", to: "/contacts", icon: Users },
      { label: "Företag", to: "/companies", icon: Building2 },
      { label: "Deals", to: "/deals", icon: Handshake },
      { label: "Offerter", to: "/quotes", icon: FileText },
    ],
  },
  {
    label: "Inflöde",
    items: [
      {
        label: "Leadimport",
        to: "/lead_import_sources",
        icon: Database,
        alsoMatch: ["/lead_import_runs"],
      },
    ],
  },
];

export function AppSidebar() {
  const { darkModeLogo, lightModeLogo, title } = useConfigurationContext();
  const { openMobile, setOpenMobile } = useSidebar();

  const handleClick = () => {
    if (openMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link to="/" onClick={handleClick}>
                <img
                  className="[.light_&]:hidden h-6 w-auto"
                  src={darkModeLogo}
                  alt={title}
                />
                <img
                  className="[.dark_&]:hidden h-6 w-auto"
                  src={lightModeLogo}
                  alt={title}
                />
                <span className="text-base font-semibold truncate">
                  {title}
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {NAV_SECTIONS.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <NavMenuItem
                    key={item.to}
                    item={item}
                    onClick={handleClick}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter />
    </Sidebar>
  );
}

const NEVER_MATCH = "__never__";

const NavMenuItem = ({
  item,
  onClick,
}: {
  item: NavItem;
  onClick?: () => void;
}) => {
  const primaryMatch = useMatch({ path: item.to, end: item.end ?? false });
  const extraMatch = useMatch({
    path: item.alsoMatch?.[0] ?? NEVER_MATCH,
    end: false,
  });
  const isActive = !!primaryMatch || !!extraMatch;
  const Icon = item.icon;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
        <Link to={item.to} state={{ _scrollToTop: true }} onClick={onClick}>
          <Icon />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
};
