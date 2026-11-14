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

/**
 * The menu of TZ section 4.1, at most 5 items: Today plus one tab per enabled
 * module. A tab covers several pages, shown as sub-tabs when there are more
 * than one; chats, purchases and money join with their modules.
 */
const SECTIONS = [
  { key: "sales", paths: ["/deals"] },
  { key: "counterparties", paths: ["/companies", "/contacts"] },
  {
    key: "stock",
    paths: [
      "/products",
      "/stock_levels",
      "/stock_moves",
      "/warehouses",
      "/inventory",
    ],
  },
] as const;

/** Sub-tab label: the resource name, or the page name for the inventory. */
const pageLabelKey = (path: string) =>
  path === "/inventory"
    ? "crm.nav.inventory"
    : `resources.${path.slice(1)}.name`;

/** Desktop header. Settings live in the profile menu. */
const Header = () => {
  const { darkModeLogo, lightModeLogo, title } = useConfigurationContext();
  const location = useLocation();
  const translate = useTranslate();

  const isToday = matchPath("/", location.pathname) != null;
  const isOn = (path: string) =>
    matchPath(`${path}/*`, location.pathname) != null;
  const section = SECTIONS.find((item) => item.paths.some(isOn));
  const currentPath = section?.paths.find(isOn);

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
            {SECTIONS.map((item) => (
              <NavigationTab
                key={item.key}
                label={translate(`crm.nav.${item.key}`)}
                to={item.paths[0]}
                isActive={item === section}
              />
            ))}
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
        {section && section.paths.length > 1 ? (
          <div className="mx-auto flex max-w-screen-xl gap-1 overflow-x-auto px-4">
            {section.paths.map((path) => (
              <SubNavigationTab
                key={path}
                to={path}
                isActive={path === currentPath}
                label={translate(pageLabelKey(path), { smart_count: 2 })}
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
