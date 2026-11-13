import { FileText, Import, Settings, User, Users } from "lucide-react";
import { CanAccess, useTranslate, useUserMenu } from "ra-core";
import { Link, matchPath, useLocation } from "react-router";
import { RefreshButton } from "@/components/admin/refresh-button";
import { ThemeModeToggle } from "@/components/admin/theme-mode-toggle";
import { UserMenu } from "@/components/admin/user-menu";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

import { useConfigurationContext } from "../root/ConfigurationContext";
import { ImportPage } from "../misc/ImportPage";
import { ChangelogPage } from "../misc/ChangelogPage";
import { GlobalSearchButton } from "../search/GlobalSearchButton";
import { BusinessMenu } from "./BusinessMenu";
import { QuickCreateButton } from "./QuickCreateButton";

const SALES_PATHS = ["/deals", "/contacts", "/companies"];

/**
 * Desktop header. The menu has the enabled sections of TZ section 4.1 only
 * (Today, Sales); chats, purchases and money appear with their modules.
 * Settings live in the profile menu.
 */
const Header = () => {
  const { darkModeLogo, lightModeLogo, title } = useConfigurationContext();
  const location = useLocation();
  const translate = useTranslate();

  const isToday = matchPath("/", location.pathname) != null;
  const salesPath = SALES_PATHS.find(
    (path) => matchPath(`${path}/*`, location.pathname) != null,
  );

  return (
    <nav aria-label={translate("crm.navigation.label")} className="grow">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-screen-xl items-center gap-6 px-4">
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2 text-foreground no-underline"
          >
            <img className="[.light_&]:hidden h-6" src={darkModeLogo} alt="" />
            <img className="[.dark_&]:hidden h-6" src={lightModeLogo} alt="" />
            <span className="text-lg font-semibold">{title}</span>
          </Link>
          <div className="flex h-full items-stretch gap-1">
            <NavigationTab
              label={translate("crm.nav.today")}
              to="/"
              isActive={isToday}
            />
            <NavigationTab
              label={translate("crm.nav.sales")}
              to="/deals"
              isActive={salesPath != null}
            />
          </div>
          <div className="ml-auto flex items-center gap-1">
            <QuickCreateButton />
            <GlobalSearchButton />
            <ThemeModeToggle />
            <RefreshButton />
            <UserMenu>
              <BusinessMenu />
              <ProfileMenu />
              <CanAccess resource="sales" action="list">
                <UsersMenu />
              </CanAccess>
              <CanAccess resource="configuration" action="edit">
                <SettingsMenu />
              </CanAccess>
              <ImportFromJsonMenuItem />
              <ChangelogMenuItem />
            </UserMenu>
          </div>
        </div>
        {salesPath != null ? (
          <div className="mx-auto flex max-w-screen-xl gap-1 px-4">
            {SALES_PATHS.map((path) => (
              <SubNavigationTab
                key={path}
                to={path}
                isActive={path === salesPath}
                label={translate(`resources.${path.slice(1)}.name`, {
                  smart_count: 2,
                })}
              />
            ))}
          </div>
        ) : null}
      </header>
    </nav>
  );
};

const NavigationTab = ({
  label,
  to,
  isActive,
}: {
  label: string;
  to: string;
  isActive: boolean;
}) => (
  <Link
    to={to}
    aria-current={isActive ? "page" : undefined}
    className={`flex items-center border-b-2 px-3 text-base font-medium transition-colors duration-150 ${
      isActive
        ? "border-primary text-foreground"
        : "border-transparent text-muted-foreground hover:text-foreground"
    }`}
  >
    {label}
  </Link>
);

const SubNavigationTab = ({
  label,
  to,
  isActive,
}: {
  label: string;
  to: string;
  isActive: boolean;
}) => (
  <Link
    to={to}
    aria-current={isActive ? "page" : undefined}
    className={`rounded-t-md px-3 py-2 text-sm font-medium transition-colors duration-150 ${
      isActive
        ? "bg-background text-foreground"
        : "text-muted-foreground hover:text-foreground"
    }`}
  >
    {label}
  </Link>
);

const UsersMenu = () => {
  const translate = useTranslate();
  const userMenuContext = useUserMenu();
  if (!userMenuContext) {
    throw new Error("<UsersMenu> must be used inside <UserMenu?");
  }
  return (
    <DropdownMenuItem
      onClick={userMenuContext.onClose}
      render={<Link to="/sales" className="flex items-center gap-2" />}
    >
      <Users />
      {translate("resources.sales.name", { smart_count: 2 })}
    </DropdownMenuItem>
  );
};

const ProfileMenu = () => {
  const translate = useTranslate();
  const userMenuContext = useUserMenu();
  if (!userMenuContext) {
    throw new Error("<ProfileMenu> must be used inside <UserMenu?");
  }
  return (
    <DropdownMenuItem
      onClick={userMenuContext.onClose}
      render={<Link to="/profile" className="flex items-center gap-2" />}
    >
      <User />
      {translate("crm.profile.title")}
    </DropdownMenuItem>
  );
};

const SettingsMenu = () => {
  const translate = useTranslate();
  const userMenuContext = useUserMenu();
  if (!userMenuContext) {
    throw new Error("<SettingsMenu> must be used inside <UserMenu>");
  }
  return (
    <DropdownMenuItem
      onClick={userMenuContext.onClose}
      render={<Link to="/settings" className="flex items-center gap-2" />}
    >
      <Settings />
      {translate("crm.settings.title")}
    </DropdownMenuItem>
  );
};

const ImportFromJsonMenuItem = () => {
  const translate = useTranslate();
  const userMenuContext = useUserMenu();
  if (!userMenuContext) {
    throw new Error("<ImportFromJsonMenuItem> must be used inside <UserMenu>");
  }
  return (
    <DropdownMenuItem
      onClick={userMenuContext.onClose}
      render={<Link to={ImportPage.path} className="flex items-center gap-2" />}
    >
      <Import />
      {translate("crm.header.import_data")}
    </DropdownMenuItem>
  );
};

const ChangelogMenuItem = () => {
  const translate = useTranslate();
  const userMenuContext = useUserMenu();
  if (!userMenuContext) {
    throw new Error("<ChangelogMenuItem> must be used inside <UserMenu>");
  }
  return (
    <DropdownMenuItem
      onClick={userMenuContext.onClose}
      render={
        <Link to={ChangelogPage.path} className="flex items-center gap-2" />
      }
    >
      <FileText />
      {translate("crm.changelog.title")}
    </DropdownMenuItem>
  );
};
export default Header;
