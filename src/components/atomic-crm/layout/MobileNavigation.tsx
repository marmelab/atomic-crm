import { useTheme } from "@/components/admin/theme-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  Building2,
  Check,
  Home,
  LogOut,
  Moon,
  Plus,
  Settings,
  Sun,
  User,
  Users,
} from "lucide-react";
import {
  CanAccess,
  Translate,
  useAuthProvider,
  useGetIdentity,
  useLogout,
  useUserMenu,
} from "ra-core";
import { Link, matchPath, useLocation } from "react-router";

export const MobileNavigation = () => {
  const location = useLocation();

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
    <nav
      aria-label="CRM navigation"
      className="fixed bottom-0 left-0 right-0 z-50 bg-secondary h-14"
    >
      <div className="flex justify-center">
        <>
          <NavigationButton
            href="/"
            Icon={Home}
            label="Home"
            isActive={currentPath === "/"}
          />
          <NavigationButton
            href="/contacts"
            Icon={Users}
            label="Contacts"
            isActive={currentPath === "/contacts"}
          />
          <CreateButton />
          <NavigationButton
            href="/companies"
            Icon={Building2}
            label="Companies"
            isActive={currentPath === "/companies"}
          />
          <SettingsButton />
        </>
      </div>
    </nav>
  );
};

const NavigationButton = ({
  href,
  Icon,
  label,
  isActive,
}: {
  href: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  isActive: boolean;
}) => (
  <Button
    asChild
    variant="ghost"
    className={cn(
      "flex-col gap-1 h-auto py-2 px-1 rounded-md w-16",
      isActive ? null : "text-muted-foreground",
    )}
  >
    <Link to={href}>
      <Icon className="size-6" />
      <span className="text-[0.6rem] font-medium">{label}</span>
    </Link>
  </Button>
);

const CreateButton = () => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        variant="default"
        size="icon"
        className="h-16 w-16 rounded-full -mt-3"
        aria-label="Create"
      >
        <Plus className="size-10" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuItem className="h-12 px-4 text-base">
        Contact
      </DropdownMenuItem>
      <DropdownMenuItem className="h-12 px-4 text-base">Note</DropdownMenuItem>
      <DropdownMenuItem className="h-12 px-4 text-base">Task</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

const SettingsButton = () => {
  const authProvider = useAuthProvider();
  const { data: identity } = useGetIdentity();
  const logout = useLogout();
  if (!authProvider) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex-col gap-1 h-auto py-2 px-1 rounded-md w-16 text-muted-foreground"
        >
          <Settings className="size-6" />
          <span className="text-[0.6rem] font-medium">Settings</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel className="font-normal h-12 px-4">
          <div className="flex flex-col justify-center h-full">
            <p className="text-base font-medium leading-none">
              {identity?.fullName}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ThemeMenu />
        <ConfigurationMenu />
        <CanAccess resource="sales" action="list">
          <UsersMenu />
        </CanAccess>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => logout()}
          className="cursor-pointer h-12 px-4 text-base"
        >
          <LogOut />
          <Translate i18nKey="ra.auth.logout">Log out</Translate>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const UsersMenu = () => {
  const { onClose } = useUserMenu() ?? {};
  return (
    <DropdownMenuItem asChild onClick={onClose} className="h-12 px-4 text-base">
      <Link to="/sales" className="flex items-center gap-2">
        <User /> Users
      </Link>
    </DropdownMenuItem>
  );
};

const ConfigurationMenu = () => {
  const { onClose } = useUserMenu() ?? {};
  return (
    <DropdownMenuItem asChild onClick={onClose} className="h-12 px-4 text-base">
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
          className="h-12 px-4 text-base"
        >
          <Sun className="rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          Theme
        </DropdownMenuItem>
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent>
          <DropdownMenuItem
            onClick={() => setTheme("light")}
            className="h-12 px-4 text-base"
          >
            Light
            <Check className={cn("ml-auto", theme !== "light" && "hidden")} />
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setTheme("dark")}
            className="h-12 px-4 text-base"
          >
            Dark
            <Check className={cn("ml-auto", theme !== "dark" && "hidden")} />
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setTheme("system")}
            className="h-12 px-4 text-base"
          >
            System
            <Check className={cn("ml-auto", theme !== "system" && "hidden")} />
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
};
