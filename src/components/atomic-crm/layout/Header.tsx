import type { LucideIcon } from "lucide-react";
import {
  Settings,
  User,
  LayoutDashboard,
  Users,
  UserCircle,
  FolderOpen,
  Briefcase,
  FileText,
  CreditCard,
  Receipt,
  ListTodo,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CanAccess, useUserMenu } from "ra-core";
import { Link, matchPath, useLocation } from "react-router";

import { RefreshButton } from "@/components/admin/refresh-button";
import { ThemeModeToggle } from "@/components/admin/theme-mode-toggle";
import { UserMenu } from "@/components/admin/user-menu";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

import { useConfigurationContext } from "../root/ConfigurationContext";

const HEADER_ITEMS: {
  path: string;
  label: string;
  icon: LucideIcon;
  color: string;
}[] = [
  { path: "/", label: "Bacheca", icon: LayoutDashboard, color: "text-sky-500" },
  { path: "/clients", label: "Clienti", icon: Users, color: "text-blue-500" },
  {
    path: "/contacts",
    label: "Referenti",
    icon: UserCircle,
    color: "text-cyan-500",
  },
  {
    path: "/projects",
    label: "Progetti",
    icon: FolderOpen,
    color: "text-amber-500",
  },
  {
    path: "/services",
    label: "Registro Lavori",
    icon: Briefcase,
    color: "text-indigo-500",
  },
  {
    path: "/quotes",
    label: "Preventivi",
    icon: FileText,
    color: "text-violet-500",
  },
  {
    path: "/payments",
    label: "Pagamenti",
    icon: CreditCard,
    color: "text-green-500",
  },
  {
    path: "/expenses",
    label: "Spese",
    icon: Receipt,
    color: "text-orange-500",
  },
  {
    path: "/client_tasks",
    label: "Promemoria",
    icon: ListTodo,
    color: "text-rose-500",
  },
];

const matchCurrentPath = (pathname: string) => {
  if (matchPath("/", pathname)) {
    return "/";
  }

  for (const item of HEADER_ITEMS) {
    if (
      matchPath(`${item.path}/*`, pathname) ||
      matchPath(item.path, pathname)
    ) {
      return item.path;
    }
  }

  return false;
};

const Header = () => {
  const { darkModeLogo, lightModeLogo, title } = useConfigurationContext();
  const location = useLocation();
  const currentPath = matchCurrentPath(location.pathname);

  return (
    <>
      <nav className="grow">
        <header className="bg-secondary">
          <div className="px-4">
            <div className="flex justify-between items-center flex-1">
              <Link
                to="/"
                className="flex items-center gap-2 text-secondary-foreground no-underline"
              >
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
                <h1 className="text-xl font-semibold">{title}</h1>
              </Link>

              <div>
                <nav className="flex">
                  {HEADER_ITEMS.map((item) => (
                    <NavigationTab
                      key={item.path}
                      label={item.label}
                      to={item.path}
                      icon={item.icon}
                      iconColor={item.color}
                      isActive={currentPath === item.path}
                    />
                  ))}
                </nav>
              </div>

              <div className="flex items-center">
                <ThemeModeToggle />
                <RefreshButton />
                <UserMenu>
                  <ProfileMenu />
                  <CanAccess resource="configuration" action="edit">
                    <SettingsMenu />
                  </CanAccess>
                </UserMenu>
              </div>
            </div>
          </div>
        </header>
      </nav>
    </>
  );
};

const NavigationTab = ({
  label,
  to,
  isActive,
  icon: Icon,
  iconColor,
}: {
  label: string;
  to: string;
  isActive: boolean;
  icon: LucideIcon;
  iconColor: string;
}) => (
  <Link
    to={to}
    className={cn(
      "group px-5 py-3 text-sm font-medium transition-all border-b-2 inline-flex items-center gap-2",
      isActive
        ? "text-secondary-foreground border-primary bg-primary/5"
        : "text-secondary-foreground/70 border-transparent hover:text-secondary-foreground hover:bg-primary/5",
    )}
  >
    <Icon
      className={cn(
        "h-4 w-4 transition-colors",
        isActive ? iconColor : "text-muted-foreground group-hover:" + iconColor,
      )}
    />
    <span>{label}</span>
  </Link>
);

const ProfileMenu = () => {
  const userMenuContext = useUserMenu();
  if (!userMenuContext) {
    throw new Error("<ProfileMenu> must be used inside <UserMenu>");
  }

  return (
    <DropdownMenuItem asChild onClick={userMenuContext.onClose}>
      <Link to="/profile" className="flex items-center gap-2">
        <User />
        Profilo
      </Link>
    </DropdownMenuItem>
  );
};

const SettingsMenu = () => {
  const userMenuContext = useUserMenu();
  if (!userMenuContext) {
    throw new Error("<SettingsMenu> must be used inside <UserMenu>");
  }

  return (
    <DropdownMenuItem asChild onClick={userMenuContext.onClose}>
      <Link to="/settings" className="flex items-center gap-2">
        <Settings /> Impostazioni
      </Link>
    </DropdownMenuItem>
  );
};

export default Header;
