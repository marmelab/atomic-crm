import { Home, Users, Building2, Briefcase, User, Settings, Import, Sliders } from "lucide-react";
import { CanAccess } from "ra-core";
import { Link, matchPath, useLocation } from "react-router";
import { cn } from "@/lib/utils";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { ImportPage } from "../misc/ImportPage";

export const Sidebar = () => {
  const { darkModeLogo, lightModeLogo, title } = useConfigurationContext();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/") {
      return matchPath("/", location.pathname) !== null && location.pathname === "/";
    }
    return matchPath(`${path}/*`, location.pathname) !== null;
  };

  return (
    <aside className="hidden md:flex flex-col w-64 border-r bg-background h-screen sticky top-0">
      {/* Logo */}
      <div className="p-4 border-b">
        <Link to="/" className="flex items-center gap-2 no-underline">
          <img
            className="[.light_&]:hidden h-6"
            src={darkModeLogo}
            alt={title}
          />
          <img
            className="[.dark_&]:hidden h-6"
            src={lightModeLogo}
            alt={title}
          />
          <h1 className="text-lg font-semibold">{title}</h1>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <SidebarLink
          to="/"
          icon={Home}
          label="Dashboard"
          isActive={isActive("/")}
        />
        <SidebarLink
          to="/contacts"
          icon={Users}
          label="Contacts"
          isActive={isActive("/contacts")}
        />
        <SidebarLink
          to="/companies"
          icon={Building2}
          label="Companies"
          isActive={isActive("/companies")}
        />
        <SidebarLink
          to="/deals"
          icon={Briefcase}
          label="Deals"
          isActive={isActive("/deals")}
        />

        <div className="pt-4">
          <div className="text-xs font-semibold text-muted-foreground px-3 pb-2">
            Settings
          </div>
          <CanAccess resource="sales" action="list">
            <SidebarLink
              to="/sales"
              icon={User}
              label="Users"
              isActive={isActive("/sales")}
            />
          </CanAccess>
          <SidebarLink
            to="/settings"
            icon={Settings}
            label="My info"
            isActive={isActive("/settings")}
          />
          <CanAccess resource="sales" action="list">
            <SidebarLink
              to="/custom-fields"
              icon={Sliders}
              label="Custom Fields"
              isActive={isActive("/custom-fields")}
            />
          </CanAccess>
          <SidebarLink
            to={ImportPage.path}
            icon={Import}
            label="Import data"
            isActive={isActive(ImportPage.path)}
          />
        </div>
      </nav>
    </aside>
  );
};

const SidebarLink = ({
  to,
  icon: Icon,
  label,
  isActive,
}: {
  to: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  isActive: boolean;
}) => (
  <Link
    to={to}
    className={cn(
      "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
      isActive
        ? "bg-secondary text-secondary-foreground"
        : "text-muted-foreground hover:bg-secondary/50 hover:text-secondary-foreground"
    )}
  >
    <Icon className="size-5" />
    <span>{label}</span>
  </Link>
);

export default Sidebar;
