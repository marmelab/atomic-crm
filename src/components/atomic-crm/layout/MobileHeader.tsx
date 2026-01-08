import { useTheme } from "@/components/admin/theme-provider";
import { UserMenu } from "@/components/admin/user-menu";
import {
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { useUserMenu } from "@/hooks/user-menu-context";
import { cn } from "@/lib/utils";
import { Check, Moon, Settings, Sun, User } from "lucide-react";
import { CanAccess } from "ra-core";
import { Link } from "react-router";

import { useConfigurationContext } from "../root/ConfigurationContext";

const MobileHeader = () => {
  const { darkModeLogo, lightModeLogo, title } = useConfigurationContext();

  return (
    <nav className="flex-grow">
      <header className="bg-secondary">
        <div className="px-4">
          <div className="flex justify-between items-center flex-1">
            <Link
              to="/"
              className="flex items-center gap-2 text-secondary-foreground no-underline py-3"
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
            <div className="flex items-center">
              <UserMenu>
                <ThemeMenu />
                <ConfigurationMenu />
                <CanAccess resource="sales" action="list">
                  <UsersMenu />
                </CanAccess>
              </UserMenu>
            </div>
          </div>
        </div>
      </header>
    </nav>
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

const ThemeMenu = () => {
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="p-0">
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
          }}
        >
          <Sun className="rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          Theme
        </DropdownMenuItem>
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent>
          <DropdownMenuItem onClick={() => setTheme("light")}>
            Light
            <Check className={cn("ml-auto", theme !== "light" && "hidden")} />
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("dark")}>
            Dark
            <Check className={cn("ml-auto", theme !== "dark" && "hidden")} />
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("system")}>
            System
            <Check className={cn("ml-auto", theme !== "system" && "hidden")} />
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
};

export default MobileHeader;
