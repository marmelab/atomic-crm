import { useMemo, useState } from "react";
import { useListFilterContext, useGetList } from "ra-core";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Search,
  Clapperboard,
  FolderOpen,
  FileText,
  Calendar,
  ChevronsUpDown,
  X,
  Filter,
  AlignLeft,
} from "lucide-react";

import type { Project, Service } from "../types";
import { DateRangeFilter } from "../filters/DateRangeFilter";
import { useConfigurationContext } from "../root/ConfigurationContext";

/* ---- Desktop sidebar ---- */
export const ServiceListFilter = () => (
  <div className="shrink-0 w-56 order-last hidden md:block">
    <ServiceFilterContent />
  </div>
);

/* ---- Mobile Sheet filter ---- */
export const ServiceMobileFilter = () => {
  const { filterValues, setFilters } = useListFilterContext();
  const activeCount = Object.keys(filterValues || {}).length;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-9"
          aria-label="Filtri"
        >
          <Filter className="size-5" />
          {activeCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs flex items-center justify-center"
            >
              {activeCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-dvh p-4 flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-xl font-semibold">Filtri</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto flex flex-col gap-6 pb-4">
          <ServiceFilterContent />
        </div>
        <SheetFooter className="relative">
          <div className="absolute -top-12 left-0 right-0 h-8 bg-linear-to-t from-background to-transparent pointer-events-none" />
          <div className="flex w-full gap-4">
            <SheetClose asChild>
              <Button
                onClick={() => setFilters({}, [])}
                type="button"
                variant="secondary"
                className="flex-1"
              >
                Cancella filtri
              </Button>
            </SheetClose>
            <SheetClose asChild>
              <Button className="flex-1">Applica</Button>
            </SheetClose>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

/* ---- Shared filter content ---- */
const ServiceFilterContent = () => {
  const { filterValues, setFilters } = useListFilterContext();
  const [projectOpen, setProjectOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const { serviceTypeChoices } = useConfigurationContext();

  const { data: projects } = useGetList<Project>("projects", {
    pagination: { page: 1, perPage: 200 },
    sort: { field: "name", order: "ASC" },
  });

  const { data: allServices } = useGetList<Service>("services", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "invoice_ref", order: "ASC" },
  });

  const invoiceRefs = useMemo(() => {
    if (!allServices) return [];
    const refs = new Set<string>();
    allServices.forEach((s) => {
      if (s.invoice_ref) refs.add(s.invoice_ref);
    });
    return Array.from(refs).sort();
  }, [allServices]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value) {
      setFilters({ ...filterValues, "location@ilike": `%${value}%` });
    } else {
      const { "location@ilike": _, ...rest } = filterValues;
      setFilters(rest);
    }
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value) {
      setFilters({ ...filterValues, "description@ilike": `%${value}%` });
    } else {
      const { "description@ilike": _, ...rest } = filterValues;
      setFilters(rest);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="relative">
        <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
        <Input
          placeholder="Cerca località..."
          className="pl-8"
          value={
            (filterValues["location@ilike"] as string)?.replace(/%/g, "") ?? ""
          }
          onChange={handleSearchChange}
        />
      </div>

      <FilterSection
        icon={<AlignLeft className="size-4" />}
        label="Descrizione"
      >
        <Input
          placeholder="Cerca nella descrizione..."
          value={
            (filterValues["description@ilike"] as string)?.replace(/%/g, "") ??
            ""
          }
          onChange={handleDescriptionChange}
        />
      </FilterSection>

      {projects && projects.length > 0 && (
        <FilterSection
          icon={<FolderOpen className="size-4" />}
          label="Progetto"
        >
          <div className="w-full">
            <Popover open={projectOpen} onOpenChange={setProjectOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Filtra per progetto"
                  className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <span className="truncate">
                    {filterValues["project_id@eq"]
                      ? (projects.find(
                          (p) => String(p.id) === filterValues["project_id@eq"],
                        )?.name ?? "Tutti")
                      : "Tutti"}
                  </span>
                  {filterValues["project_id@eq"] ? (
                    <X
                      className="size-3.5 shrink-0 opacity-50 hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        const { "project_id@eq": _, ...rest } = filterValues;
                        setFilters(rest);
                      }}
                    />
                  ) : (
                    <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Cerca progetto..." />
                  <CommandList>
                    <CommandEmpty>Nessun progetto</CommandEmpty>
                    <CommandGroup>
                      {projects.map((p) => (
                        <CommandItem
                          key={String(p.id)}
                          value={p.name}
                          onSelect={() => {
                            setFilters({
                              ...filterValues,
                              "project_id@eq": String(p.id),
                            });
                            setProjectOpen(false);
                          }}
                        >
                          {p.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </FilterSection>
      )}

      <FilterSection
        icon={<Clapperboard className="size-4" />}
        label="Tipo servizio"
      >
        {serviceTypeChoices.map((type) => (
          <FilterBadge
            key={type.value}
            label={type.label}
            isActive={filterValues["service_type@eq"] === type.value}
            onToggle={() => {
              if (filterValues["service_type@eq"] === type.value) {
                const { "service_type@eq": _, ...rest } = filterValues;
                setFilters(rest);
              } else {
                setFilters({
                  ...filterValues,
                  "service_type@eq": type.value,
                });
              }
            }}
          />
        ))}
      </FilterSection>

      {invoiceRefs.length > 0 && (
        <FilterSection
          icon={<FileText className="size-4" />}
          label="Rif. Fattura"
        >
          <div className="w-full">
            <Popover open={invoiceOpen} onOpenChange={setInvoiceOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Filtra per fattura"
                  className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <span className="truncate">
                    {(filterValues["invoice_ref@eq"] as string) ?? "Tutte"}
                  </span>
                  {filterValues["invoice_ref@eq"] ? (
                    <X
                      className="size-3.5 shrink-0 opacity-50 hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        const { "invoice_ref@eq": _, ...rest } = filterValues;
                        setFilters(rest);
                      }}
                    />
                  ) : (
                    <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Cerca fattura..." />
                  <CommandList>
                    <CommandEmpty>Nessuna fattura</CommandEmpty>
                    <CommandGroup>
                      {invoiceRefs.map((ref) => (
                        <CommandItem
                          key={ref}
                          value={ref}
                          onSelect={() => {
                            setFilters({
                              ...filterValues,
                              "invoice_ref@eq": ref,
                            });
                            setInvoiceOpen(false);
                          }}
                        >
                          {ref}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </FilterSection>
      )}

      <FilterSection icon={<Calendar className="size-4" />} label="Periodo">
        <DateRangeFilter
          fromKey="service_date@gte"
          toKey="service_date@lte"
          filterValues={filterValues}
          setFilters={setFilters}
        />
      </FilterSection>
    </div>
  );
};

/* ---- Helpers ---- */
const FilterSection = ({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) => (
  <div>
    <div className="flex items-center gap-2 mb-2 text-sm font-medium text-muted-foreground">
      {icon}
      {label}
    </div>
    <div className="flex flex-wrap gap-1.5">{children}</div>
  </div>
);

const FilterBadge = ({
  label,
  isActive,
  onToggle,
}: {
  label: string;
  isActive: boolean;
  onToggle: () => void;
}) => (
  <Badge
    variant={isActive ? "default" : "outline"}
    className="cursor-pointer"
    onClick={onToggle}
  >
    {label}
  </Badge>
);
