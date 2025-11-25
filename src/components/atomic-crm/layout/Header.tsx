import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Menu, Settings, User } from "lucide-react";
import { CanAccess } from "ra-core";
import { Link, type LinkProps, matchPath, useLocation } from "react-router";
import { RefreshButton } from "@/components/admin/refresh-button";
import { ThemeModeToggle } from "@/components/admin/theme-mode-toggle";
import { UserMenu } from "@/components/admin/user-menu";
import { useUserMenu } from "@/hooks/user-menu-context";

import { useConfigurationContext } from "../root/ConfigurationContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { type RefAttributes, useState } from "react";
import {
  NavigationMenu,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";

const Header = () => {
  const location = useLocation();
  const isMobile = useIsMobile();

  let currentPath: string | boolean = "/";
  if (matchPath("/", location.pathname)) {
    currentPath = "/";
  } else if (matchPath("/contacts/*", location.pathname)) {
    currentPath = "/contacts";
  } else if (matchPath("/companies/*", location.pathname)) {
    currentPath = "/companies";
  } else if (matchPath("/deals/*", location.pathname)) {
    currentPath = "/deals";
  } else {
    currentPath = false;
  }

  return (
    <nav className="flex-grow">
      <header className="bg-secondary">
        {isMobile ? (
          <MobileHeader currentPath={currentPath} />
        ) : (
          <DesktopHeader currentPath={currentPath} />
        )}
      </header>
    </nav>
  );
};

const MobileHeader = ({ currentPath }: { currentPath: string | boolean }) => {
  const { title } = useConfigurationContext();
  const [open, setOpen] = useState(false);
  return (
    <div className="p-2 flex w-full items-center">
      <Drawer direction="left" modal open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Menu />
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Menu</DrawerTitle>
          </DrawerHeader>
          <div className="px-2">
            <NavigationMenu orientation="vertical">
              <NavigationMenuList className="flex-col items-start space-x-0">
                <NavigationMenuLink
                  asChild
                  className={navigationMenuTriggerStyle()}
                >
                  <NavigationLink
                    label="Dashboard"
                    to="/"
                    isActive={currentPath === "/"}
                    ref={(element) => element?.focus()}
                    onClick={() => setOpen(false)}
                  />
                </NavigationMenuLink>
                <NavigationMenuLink
                  asChild
                  className={navigationMenuTriggerStyle()}
                >
                  <NavigationLink
                    label="Contacts"
                    to="/contacts"
                    isActive={currentPath === "/contacts"}
                    onClick={() => setOpen(false)}
                  />
                </NavigationMenuLink>
                <NavigationMenuLink
                  asChild
                  className={navigationMenuTriggerStyle()}
                >
                  <NavigationLink
                    label="Companies"
                    to="/companies"
                    isActive={currentPath === "/companies"}
                    onClick={() => setOpen(false)}
                  />
                </NavigationMenuLink>
                <NavigationMenuLink
                  asChild
                  className={navigationMenuTriggerStyle()}
                >
                  <NavigationLink
                    label="Deals"
                    to="/deals"
                    isActive={currentPath === "/deals"}
                    onClick={() => setOpen(false)}
                  />
                </NavigationMenuLink>
              </NavigationMenuList>
            </NavigationMenu>
          </div>
        </DrawerContent>
      </Drawer>
      <h1 className="grow text-xl font-semibold px-2">{title}</h1>
      <UserMenu>
        <ConfigurationMenu />
        <CanAccess resource="sales" action="list">
          <UsersMenu />
        </CanAccess>
      </UserMenu>
    </div>
  );
};

const DesktopHeader = ({ currentPath }: { currentPath: string | boolean }) => {
  const { darkModeLogo, lightModeLogo, title } = useConfigurationContext();
  return (
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
          <nav className="flex flex-col md:flex-row">
            <NavigationLink
              label="Dashboard"
              to="/"
              isActive={currentPath === "/"}
            />
            <NavigationLink
              label="Contacts"
              to="/contacts"
              isActive={currentPath === "/contacts"}
            />
            <NavigationLink
              label="Companies"
              to="/companies"
              isActive={currentPath === "/companies"}
            />
            <NavigationLink
              label="Deals"
              to="/deals"
              isActive={currentPath === "/deals"}
            />
          </nav>
        </div>
        <div className="flex items-center">
          <ThemeModeToggle />
          <RefreshButton />
          <UserMenu>
            <ConfigurationMenu />
            <CanAccess resource="sales" action="list">
              <UsersMenu />
            </CanAccess>
          </UserMenu>
        </div>
      </div>
    </div>
  );
};

const NavigationLink = ({
  label,
  to,
  isActive,
  ...props
}: {
  label: string;
  to: string;
  isActive: boolean;
} & LinkProps &
  RefAttributes<HTMLAnchorElement>) => {
  return (
    <Link
      to={to}
      className={cn(
        "px-6 py-3 text-sm font-medium transition-colors md:border-b-2 w-full",
        {
          "text-secondary-foreground border-secondary-foreground": isActive,
          "text-secondary-foreground/70 border-transparent hover:text-secondary-foreground/80":
            !isActive,
        },
      )}
      {...props}
    >
      {label}
    </Link>
  );
};

const UsersMenu = () => {
  const { onClose } = useUserMenu() ?? {};
  return (
    <DropdownMenuItem asChild onClick={onClose}>
      <Link to="/sales" className="flex items-center gap-2">
        <User /> Users
      </Link>
    </DropdownMenuItem>
  );
};

const ConfigurationMenu = () => {
  const { onClose } = useUserMenu() ?? {};
  return (
    <DropdownMenuItem asChild onClick={onClose}>
      <Link to="/settings" className="flex items-center gap-2">
        <Settings />
        My info
      </Link>
    </DropdownMenuItem>
  );
};
export default Header;
