import { useTheme } from "@/components/admin/theme-provider";
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
  ListTodo,
  LogOut,
  Moon,
  Plus,
  Settings,
  Smartphone,
  Sun,
  Users,
} from "lucide-react";
import {
  Translate,
  useAuthProvider,
  useCreatePath,
  useGetIdentity,
  useLogout,
} from "ra-core";
import {
  Link,
  matchPath,
  useLocation,
  useMatch,
  useNavigate,
} from "react-router";

export const MobileNavigation = () => {
  const location = useLocation();

  let currentPath: string | boolean = "/";
  if (matchPath("/", location.pathname)) {
    currentPath = "/";
  } else if (matchPath("/contacts/*", location.pathname)) {
    currentPath = "/contacts";
  } else if (matchPath("/companies/*", location.pathname)) {
    currentPath = "/companies";
  } else if (matchPath("/tasks/*", location.pathname)) {
    currentPath = "/tasks";
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
            href="/tasks"
            Icon={ListTodo}
            label="Tasks"
            isActive={currentPath === "/tasks"}
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

const CreateButton = () => {
  const contact_id = useMatch("/contacts/:id/*")?.params.id;
  const navigate = useNavigate();
  const createPath = useCreatePath();

  return (
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
        <DropdownMenuItem className="h-12 px-4 text-base">
          Note
        </DropdownMenuItem>
        <DropdownMenuItem
          className="h-12 px-4 text-base"
          onSelect={() => {
            navigate(
              createPath({
                resource: "tasks",
                type: "create",
              }),
              {
                state: contact_id
                  ? {
                      record: { contact_id },
                    }
                  : undefined,
              },
            );
          }}
        >
          Task
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
          aria-label="System theme"
          className="px-3"
        >
          <Smartphone className="size-5 mx-2" />
          <span className="sr-only">System</span>
        </ToggleGroupItem>
        <ToggleGroupItem
          value="light"
          aria-label="Light theme"
          className="px-3"
        >
          <Sun className="size-5 mx-2" />
          <span className="sr-only">Light</span>
        </ToggleGroupItem>
        <ToggleGroupItem value="dark" aria-label="Dark theme" className="px-3">
          <Moon className="size-5 mx-2" />
          <span className="sr-only">Dark</span>
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
};
