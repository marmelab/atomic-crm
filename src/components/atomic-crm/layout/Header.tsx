import { Settings, User } from "lucide-react";
import { CanAccess, useUserMenu } from "ra-core";
import { Link, matchPath, useLocation } from "react-router";
import type { ComponentType } from "react";

import { RefreshButton } from "@/components/admin/refresh-button";
import { ThemeModeToggle } from "@/components/admin/theme-mode-toggle";
import { UserMenu } from "@/components/admin/user-menu";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

import { useConfigurationContext } from "../root/ConfigurationContext";
import { getDesktopHeaderModules } from "../root/moduleRegistry";

const matchCurrentPath = (pathname: string) => {
  if (matchPath("/", pathname)) {
    return "/";
  }

  for (const module of getDesktopHeaderModules()) {
    if (
      matchPath(`${module.path}/*`, pathname) ||
      matchPath(module.path, pathname)
    ) {
      return module.path;
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
                  <NavigationTab
                    label="Bacheca"
                    to="/"
                    isActive={currentPath === "/"}
                  />
                  {getDesktopHeaderModules().map((module) => (
                    <NavigationTab
                      key={module.resource}
                      label={module.label}
                      to={module.path}
                      isActive={currentPath === module.path}
                      BadgeComponent={module.badge}
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
  BadgeComponent,
}: {
  label: string;
  to: string;
  isActive: boolean;
  BadgeComponent?: ComponentType;
}) => (
  <Link
    to={to}
    className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
      isActive
        ? "text-secondary-foreground border-secondary-foreground"
        : "text-secondary-foreground/70 border-transparent hover:text-secondary-foreground/80"
    }`}
  >
    <span className="inline-flex items-center">
      {label}
      {BadgeComponent ? <BadgeComponent /> : null}
    </span>
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
