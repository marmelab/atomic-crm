import { Import, Plus, Plug, Settings, User, Users } from "lucide-react";
import { CanAccess, useCanAccess, useGetIdentity, useUserMenu } from "ra-core";
import { useState } from "react";
import { Link, matchPath, useLocation } from "react-router";
import { RefreshButton } from "@/components/admin/refresh-button";
import { ThemeModeToggle } from "@/components/admin/theme-mode-toggle";
import { UserMenu } from "@/components/admin/user-menu";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

import { useConfigurationContext } from "../root/ConfigurationContext";
import { ImportPage } from "../misc/ImportPage";
import { CreateViewDialog } from "../deals/CreateViewDialog";

const Header = () => {
  const { darkModeLogo, lightModeLogo, title, customViews } =
    useConfigurationContext();
  const location = useLocation();
  const [createViewOpen, setCreateViewOpen] = useState(false);
  const { identity } = useGetIdentity();
  const { canAccess: isAdmin } = useCanAccess({
    resource: "configuration",
    action: "edit",
  });

  // Filter views: admins see all, regular users see views where allowedUserIds is empty or includes them
  const currentSaleId = identity?.id as number | undefined;
  const visibleViews = customViews.filter(
    (view) =>
      isAdmin ||
      !view.allowedUserIds?.length ||
      (currentSaleId != null && view.allowedUserIds.includes(currentSaleId)),
  );

  let currentPath: string | boolean = "/";
  if (matchPath("/", location.pathname)) {
    currentPath = "/";
  } else if (matchPath("/contacts/*", location.pathname)) {
    currentPath = "/contacts";
  } else if (matchPath("/companies/*", location.pathname)) {
    currentPath = "/companies";
  } else if (matchPath("/deals/*", location.pathname)) {
    currentPath = "/deals";
  } else if (matchPath("/views/:viewId/*", location.pathname)) {
    const match = matchPath("/views/:viewId/*", location.pathname);
    currentPath = `/views/${match?.params.viewId}`;
  } else {
    currentPath = false;
  }

  return (
    <>
      <CreateViewDialog
        open={createViewOpen}
        onClose={() => setCreateViewOpen(false)}
      />
      <nav className="sticky top-0 z-50 grow">
        <header className="bg-secondary shadow-sm">
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
                <nav className="flex items-center">
                  <NavigationTab
                    label="Tableau de bord"
                    to="/"
                    isActive={currentPath === "/"}
                  />
                  <NavigationTab
                    label="Contacts"
                    to="/contacts"
                    isActive={currentPath === "/contacts"}
                  />
                  <NavigationTab
                    label="Sociétés"
                    to="/companies"
                    isActive={currentPath === "/companies"}
                  />
                  <NavigationTab
                    label="Opportunités"
                    to="/deals"
                    isActive={currentPath === "/deals"}
                  />
                  {visibleViews.map((view) => (
                    <NavigationTab
                      key={view.id}
                      label={view.label}
                      to={`/views/${view.id}`}
                      isActive={currentPath === `/views/${view.id}`}
                    />
                  ))}
                  {isAdmin && (
                    <button
                      onClick={() => setCreateViewOpen(true)}
                      title="Créer une nouvelle vue"
                      className="flex items-center justify-center w-7 h-7 ml-1 rounded-full text-secondary-foreground/50 hover:text-secondary-foreground hover:bg-secondary-foreground/10 transition-all"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  )}
                </nav>
              </div>
              <div className="flex items-center">
                <ThemeModeToggle />
                <RefreshButton />
                <UserMenu>
                  <ProfileMenu />
                  <CanAccess resource="sales" action="list">
                    <UsersMenu />
                  </CanAccess>
                  <ConnectorsMenu />
                  <CanAccess resource="configuration" action="edit">
                    <SettingsMenu />
                  </CanAccess>
                  <ImportFromJsonMenuItem />
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
}: {
  label: string;
  to: string;
  isActive: boolean;
}) => (
  <Link
    to={to}
    className={`px-6 py-3.5 text-sm font-medium transition-all duration-200 border-b-[2.5px] ${
      isActive
        ? "text-secondary-foreground border-[var(--nosho-green)]"
        : "text-secondary-foreground/60 border-transparent hover:text-secondary-foreground/80 hover:border-secondary-foreground/20"
    }`}
  >
    {label}
  </Link>
);

const UsersMenu = () => {
  const userMenuContext = useUserMenu();
  if (!userMenuContext) {
    throw new Error("<UsersMenu> must be used inside <UserMenu?");
  }
  return (
    <DropdownMenuItem asChild onClick={userMenuContext.onClose}>
      <Link to="/sales" className="flex items-center gap-2">
        <Users /> Utilisateurs
      </Link>
    </DropdownMenuItem>
  );
};

const ProfileMenu = () => {
  const userMenuContext = useUserMenu();
  if (!userMenuContext) {
    throw new Error("<ProfileMenu> must be used inside <UserMenu?");
  }
  return (
    <DropdownMenuItem asChild onClick={userMenuContext.onClose}>
      <Link to="/profile" className="flex items-center gap-2">
        <User />
        Profil
      </Link>
    </DropdownMenuItem>
  );
};

const ConnectorsMenu = () => {
  const userMenuContext = useUserMenu();
  if (!userMenuContext) {
    throw new Error("<ConnectorsMenu> must be used inside <UserMenu>");
  }
  return (
    <DropdownMenuItem asChild onClick={userMenuContext.onClose}>
      <Link to="/connectors" className="flex items-center gap-2">
        <Plug /> Connecteurs
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
        <Settings /> Paramètres
      </Link>
    </DropdownMenuItem>
  );
};

const ImportFromJsonMenuItem = () => {
  const userMenuContext = useUserMenu();
  if (!userMenuContext) {
    throw new Error("<ImportFromJsonMenuItem> must be used inside <UserMenu>");
  }
  return (
    <DropdownMenuItem asChild onClick={userMenuContext.onClose}>
      <Link to={ImportPage.path} className="flex items-center gap-2">
        <Import /> Importer
      </Link>
    </DropdownMenuItem>
  );
};
export default Header;
