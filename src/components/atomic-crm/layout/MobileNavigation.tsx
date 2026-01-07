import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Building2, HandHeart, Home, Plus, Users } from "lucide-react";
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
          <NavigationButton
            href="/deals"
            Icon={HandHeart}
            label="Deals"
            isActive={currentPath === "/deals"}
          />
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
      <DropdownMenuItem>Contact</DropdownMenuItem>
      <DropdownMenuItem>Note</DropdownMenuItem>
      <DropdownMenuItem>Task</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);
