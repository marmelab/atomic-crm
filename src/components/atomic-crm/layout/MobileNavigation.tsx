import { useTheme } from "@/components/admin/use-theme";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import {
  Home,
  LogOut,
  Moon,
  Plus,
  Settings,
  Smartphone,
  Sun,
  User,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useState, type ComponentType } from "react";
import { Translate, useAuthProvider, useGetIdentity, useLogout } from "ra-core";
import {
  Link,
  matchPath,
  useLocation,
  useMatch,
  useNavigate,
} from "react-router";

import {
  getMobileAltroModules,
  getMobileBottomBarModules,
  getMobileCreateModules,
} from "../root/moduleRegistry";
import { TaskCreateSheet } from "../tasks/TaskCreateSheet";

const matchCurrentPath = (pathname: string) => {
  if (matchPath("/", pathname)) {
    return "/";
  }

  for (const module of getMobileBottomBarModules()) {
    if (
      matchPath(`${module.path}/*`, pathname) ||
      matchPath(module.path, pathname)
    ) {
      return module.path;
    }
  }

  return false;
};

const createMenuLabelByResource: Record<string, string> = {
  expenses: "Spesa",
  services: "Lavoro",
  payments: "Pagamento",
  client_tasks: "Promemoria",
};

export const MobileNavigation = () => {
  const location = useLocation();
  const currentPath = matchCurrentPath(location.pathname);

  const isPwa = window.matchMedia("(display-mode: standalone)").matches;
  const isWebiOS = /iPad|iPod|iPhone/.test(window.navigator.userAgent);

  return (
    <nav
      aria-label="Navigazione CRM"
      className="fixed bottom-0 left-0 right-0 z-50 bg-secondary h-14"
      style={{
        paddingBottom: isPwa && isWebiOS ? 15 : undefined,
        height:
          "calc(var(--spacing)) * 6" + (isPwa && isWebiOS ? " + 15px" : ""),
      }}
    >
      <div className="flex justify-center">
        <NavigationButton
          href="/"
          Icon={Home}
          label="Inizio"
          isActive={currentPath === "/"}
        />

        {getMobileBottomBarModules().map((module) => (
          <NavigationButton
            key={module.resource}
            href={module.path}
            Icon={module.icon ?? Home}
            label={module.label}
            isActive={currentPath === module.path}
            BadgeComponent={module.badge}
          />
        ))}

        <CreateButton />
        <SettingsButton />
      </div>
    </nav>
  );
};

const NavigationButton = ({
  href,
  Icon,
  label,
  isActive,
  BadgeComponent,
}: {
  href: string;
  Icon: LucideIcon;
  label: string;
  isActive: boolean;
  BadgeComponent?: ComponentType;
}) => (
  <Button
    asChild
    variant="ghost"
    className={cn(
      "relative flex-col gap-1 h-auto py-2 px-1 rounded-md w-16",
      isActive ? null : "text-muted-foreground",
    )}
  >
    <Link to={href}>
      <Icon className="size-6" />
      <span className="text-[0.6rem] font-medium text-center leading-tight">
        {label}
      </span>
      {BadgeComponent ? (
        <span className="absolute -top-1 right-0">
          <BadgeComponent />
        </span>
      ) : null}
    </Link>
  </Button>
);

const CreateButton = () => {
  const clientId = useMatch("/clients/:id/*")?.params.id;
  const [taskCreateOpen, setTaskCreateOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <TaskCreateSheet
        open={taskCreateOpen}
        onOpenChange={setTaskCreateOpen}
        client_id={clientId}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="default"
            size="icon"
            className="h-16 w-16 rounded-full -mt-3"
            aria-label="Crea"
          >
            <Plus className="size-10" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {getMobileCreateModules().map((module) => (
            <DropdownMenuItem
              key={module.resource}
              className="h-12 px-4 text-base"
              onSelect={() => {
                if (
                  module.nav.mobile.createMenuAction === "sheet" &&
                  module.resource === "client_tasks"
                ) {
                  setTaskCreateOpen(true);
                  return;
                }

                navigate(`${module.path}/create`);
              }}
            >
              {createMenuLabelByResource[module.resource] ?? module.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};

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
          <span className="text-[0.6rem] font-medium">Altro</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" side="top" className="w-64">
        <DropdownMenuLabel className="font-normal h-12 px-4">
          <div className="flex items-center gap-3 h-full">
            <Avatar className="h-8 w-8">
              <AvatarImage src={identity?.avatar} role="presentation" />
              <AvatarFallback>{identity?.fullName?.charAt(0)}</AvatarFallback>
            </Avatar>
            <p className="text-base font-medium leading-none">
              {identity?.fullName}
            </p>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {getMobileAltroModules().map((module) => {
          const Icon = module.icon ?? Home;
          const iconColor = module.iconColor;

          return (
            <DropdownMenuItem
              key={module.resource}
              asChild
              className="h-14 px-4 text-lg gap-3"
            >
              <Link to={module.path}>
                <Icon className={cn("size-6", iconColor)} />
                {module.label}
              </Link>
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild className="h-14 px-4 text-lg gap-3">
          <Link to="/profile">
            <User className="size-6 text-muted-foreground" />
            Profilo
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="h-14 px-4 text-lg gap-3">
          <Link to="/settings">
            <Wrench className="size-6 text-muted-foreground" />
            Impostazioni
          </Link>
        </DropdownMenuItem>

        <ThemeMenu />
        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => logout()}
          className="cursor-pointer h-14 px-4 text-lg gap-3 text-destructive"
        >
          <LogOut className="size-6" />
          <Translate i18nKey="ra.auth.logout">Log out</Translate>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const ThemeMenu = () => {
  const { theme, setTheme } = useTheme();

  return (
    <div className="px-3 py-2">
      <ToggleGroup
        type="single"
        value={theme}
        onValueChange={(value) =>
          value && setTheme(value as "light" | "dark" | "system")
        }
        className="justify-start"
        size="lg"
        variant="outline"
      >
        <ToggleGroupItem
          value="system"
          aria-label="Tema di sistema"
          className="px-3"
        >
          <Smartphone className="size-5 mx-2" />
          <span className="sr-only">Sistema</span>
        </ToggleGroupItem>
        <ToggleGroupItem
          value="light"
          aria-label="Tema chiaro"
          className="px-3"
        >
          <Sun className="size-5 mx-2" />
          <span className="sr-only">Chiaro</span>
        </ToggleGroupItem>
        <ToggleGroupItem value="dark" aria-label="Tema scuro" className="px-3">
          <Moon className="size-5 mx-2" />
          <span className="sr-only">Scuro</span>
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
};
