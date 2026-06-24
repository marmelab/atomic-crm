import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  Building2,
  CalendarDays,
  Database,
  FileText,
  Handshake,
  Home,
  ListTodo,
  MoreHorizontal,
  Phone,
  Plus,
  Radar,
  Settings,
  Users,
} from "lucide-react";
import { useTranslate } from "ra-core";
import { Link, matchPath, useLocation, useMatch } from "react-router";
import { ContactCreateSheet } from "../contacts/ContactCreateSheet";
import { useState } from "react";
import { NoteCreateSheet } from "../notes/NoteCreateSheet";
import { TaskCreateSheet } from "../tasks/TaskCreateSheet";
import { DealCreateSheet } from "../deals/DealCreateSheet";
import { CompanyCreateSheet } from "../companies/CompanyCreateSheet";
import { QuoteCreateSheet } from "../quotes/QuoteCreateSheet";
import { MOBILE_NAV_CREATE_BUTTON_LIFT } from "./mobileLayoutConstants";

export const MobileNavigation = () => {
  const location = useLocation();
  const translate = useTranslate();

  let currentPath: string | boolean = "/";
  if (matchPath("/", location.pathname)) {
    currentPath = "/";
  } else if (matchPath("/contacts/*", location.pathname)) {
    currentPath = "/contacts";
  } else if (matchPath("/calendar/*", location.pathname)) {
    currentPath = "/calendar";
  } else if (matchPath("/companies/*", location.pathname)) {
    currentPath = "/companies";
  } else if (matchPath("/tasks/*", location.pathname)) {
    currentPath = "/tasks";
  } else if (matchPath("/deals/*", location.pathname)) {
    currentPath = "/deals";
  } else if (matchPath("/call-queue", location.pathname)) {
    currentPath = "/call-queue";
  } else if (matchPath("/customer-radar", location.pathname)) {
    currentPath = "/customer-radar";
  } else if (matchPath("/quotes/*", location.pathname)) {
    currentPath = "/quotes";
  } else if (matchPath("/settings", location.pathname)) {
    currentPath = "/settings";
  } else if (
    matchPath("/lead_import_sources", location.pathname) ||
    matchPath("/lead_import_runs", location.pathname)
  ) {
    currentPath = "/lead-import";
  } else {
    currentPath = false;
  }

  const isMoreActive =
    currentPath === "/companies" ||
    currentPath === "/deals" ||
    currentPath === "/quotes" ||
    currentPath === "/tasks" ||
    currentPath === "/calendar" ||
    currentPath === "/settings" ||
    currentPath === "/lead-import" ||
    currentPath === "/customer-radar";

  return (
    <nav
      aria-label={translate("crm.navigation.label")}
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-secondary/95 backdrop-blur supports-[backdrop-filter]:bg-secondary/90"
      style={{
        paddingBottom: "var(--crm-mobile-safe-bottom)",
        minHeight: "var(--crm-mobile-nav-height)",
      }}
    >
      <div className="mx-auto flex max-w-screen-xl items-end justify-center px-2">
        <>
          <NavigationButton
            href="/"
            Icon={Home}
            label={translate("ra.page.dashboard")}
            isActive={currentPath === "/"}
          />
          <NavigationButton
            href="/contacts"
            Icon={Users}
            label={translate("resources.contacts.name", {
              smart_count: 2,
            })}
            isActive={currentPath === "/contacts"}
          />
          <CreateButton />
          <NavigationButton
            href="/call-queue"
            Icon={Phone}
            label="Ringlista"
            isActive={currentPath === "/call-queue"}
          />
          <MoreMenu isActive={isMoreActive} />
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
      "h-auto min-w-0 flex-1 rounded-md px-1 py-2",
      isActive ? null : "text-muted-foreground",
    )}
  >
    <Link to={href} className="flex min-w-0 flex-col items-center gap-1">
      <Icon className="size-5 shrink-0" />
      <span className="max-w-full truncate text-[11px] font-medium leading-tight">
        {label}
      </span>
    </Link>
  </Button>
);

const CreateButton = () => {
  const translate = useTranslate();
  const contact_id = useMatch("/contacts/:id/*")?.params.id;
  const [contactCreateOpen, setContactCreateOpen] = useState(false);
  const [noteCreateOpen, setNoteCreateOpen] = useState(false);
  const [taskCreateOpen, setTaskCreateOpen] = useState(false);
  const [dealCreateOpen, setDealCreateOpen] = useState(false);
  const [companyCreateOpen, setCompanyCreateOpen] = useState(false);
  const [quoteCreateOpen, setQuoteCreateOpen] = useState(false);

  return (
    <>
      <ContactCreateSheet
        open={contactCreateOpen}
        onOpenChange={setContactCreateOpen}
      />
      <NoteCreateSheet
        open={noteCreateOpen}
        onOpenChange={setNoteCreateOpen}
        contact_id={contact_id}
      />
      <TaskCreateSheet
        open={taskCreateOpen}
        onOpenChange={setTaskCreateOpen}
        contact_id={contact_id}
      />
      <DealCreateSheet open={dealCreateOpen} onOpenChange={setDealCreateOpen} />
      <CompanyCreateSheet
        open={companyCreateOpen}
        onOpenChange={setCompanyCreateOpen}
      />
      <QuoteCreateSheet
        open={quoteCreateOpen}
        onOpenChange={setQuoteCreateOpen}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="default"
            size="icon"
            className="size-14 shrink-0 rounded-full shadow-lg"
            style={{
              transform: `translateY(calc(-1 * ${MOBILE_NAV_CREATE_BUTTON_LIFT}))`,
            }}
            aria-label={translate("ra.action.create")}
          >
            <Plus className="size-7" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" sideOffset={12}>
          <DropdownMenuItem
            className="h-12 px-4 text-base"
            onSelect={() => {
              setContactCreateOpen(true);
            }}
          >
            {translate("resources.contacts.forcedCaseName")}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="h-12 px-4 text-base"
            onSelect={() => {
              setCompanyCreateOpen(true);
            }}
          >
            {translate("resources.companies.name", {
              smart_count: 1,
              _: "Företag",
            })}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="h-12 px-4 text-base"
            onSelect={() => {
              setDealCreateOpen(true);
            }}
          >
            {translate("resources.deals.name", {
              smart_count: 1,
              _: "Deal",
            })}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="h-12 px-4 text-base"
            onSelect={() => {
              setQuoteCreateOpen(true);
            }}
          >
            {translate("resources.quotes.name", {
              smart_count: 1,
              _: "Offert",
            })}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="h-12 px-4 text-base"
            onSelect={() => {
              setNoteCreateOpen(true);
            }}
          >
            {translate("resources.notes.forcedCaseName")}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="h-12 px-4 text-base"
            onSelect={() => {
              setTaskCreateOpen(true);
            }}
          >
            {translate("resources.tasks.forcedCaseName")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};

const MoreMenu = ({ isActive }: { isActive: boolean }) => {
  const translate = useTranslate();
  const [open, setOpen] = useState(false);

  const menuItems = [
    {
      href: "/customer-radar",
      Icon: Radar,
      label: "Kundradar",
    },
    {
      href: "/companies",
      Icon: Building2,
      label: translate("resources.companies.name", { smart_count: 2 }),
    },
    {
      href: "/deals",
      Icon: Handshake,
      label: translate("resources.deals.name", { smart_count: 2 }),
    },
    {
      href: "/quotes",
      Icon: FileText,
      label: translate("resources.quotes.name", {
        smart_count: 2,
        _: "Offerter",
      }),
    },
    {
      href: "/tasks",
      Icon: ListTodo,
      label: translate("resources.tasks.name", {
        smart_count: 2,
        _: "Tasks",
      }),
    },
    {
      href: "/calendar",
      Icon: CalendarDays,
      label: translate("resources.calendar_events.name", {
        smart_count: 2,
        _: "Kalender",
      }),
    },
    {
      href: "/lead_import_sources",
      Icon: Database,
      label: "Leadimport",
    },
    {
      href: "/settings",
      Icon: Settings,
      label: translate("crm.settings.title"),
    },
  ];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "h-auto min-w-0 flex-1 rounded-md px-1 py-2",
            isActive ? null : "text-muted-foreground",
          )}
        >
          <div className="flex min-w-0 flex-col items-center gap-1">
            <MoreHorizontal className="size-5 shrink-0" />
            <span className="max-w-full truncate text-[11px] font-medium leading-tight">
              Mer
            </span>
          </div>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="max-h-[min(80dvh,42rem)] overflow-y-auto pb-[calc(var(--crm-mobile-safe-bottom)+1.5rem)]"
      >
        <SheetHeader>
          <SheetTitle>Meny</SheetTitle>
        </SheetHeader>
        <div className="grid grid-cols-3 gap-4 pt-4">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setOpen(false)}
              className="flex flex-col items-center gap-2 p-4 rounded-lg hover:bg-muted transition-colors no-underline text-foreground"
            >
              <item.Icon className="size-8" />
              <span className="text-xs font-medium text-center">
                {item.label}
              </span>
            </Link>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};
