import { useState } from "react";
import { useListFilterContext, useGetList } from "ra-core";
import { Badge } from "@/components/ui/badge";
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
  CircleDollarSign,
  FolderOpen,
  User,
  Calendar,
  ChevronsUpDown,
  X,
  Filter,
} from "lucide-react";

import type { Client, Project } from "../types";
import { DateRangeFilter } from "../filters/DateRangeFilter";
import { FilterSection, FilterBadge } from "../filters/FilterHelpers";
import { paymentStatusChoices } from "./paymentTypes";

/* ---- Desktop sidebar ---- */
export const PaymentListFilter = () => (
  <div className="shrink-0 w-56 order-last hidden md:block">
    <PaymentFilterContent />
  </div>
);

/* ---- Mobile Sheet filter ---- */
export const PaymentMobileFilter = () => {
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
          <PaymentFilterContent />
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
const PaymentFilterContent = () => {
  const { filterValues, setFilters } = useListFilterContext();
  const [clientOpen, setClientOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);

  const { data: clients } = useGetList<Client>("clients", {
    pagination: { page: 1, perPage: 200 },
    sort: { field: "name", order: "ASC" },
  });

  const { data: projects } = useGetList<Project>("projects", {
    pagination: { page: 1, perPage: 200 },
    sort: { field: "name", order: "ASC" },
  });

  return (
    <div className="flex flex-col gap-6">
      <FilterSection
        icon={<CircleDollarSign className="size-4" />}
        label="Stato"
      >
        {paymentStatusChoices.map((status) => (
          <FilterBadge
            key={status.id}
            label={status.name}
            isActive={filterValues["status@eq"] === status.id}
            onToggle={() => {
              if (filterValues["status@eq"] === status.id) {
                const { "status@eq": _, ...rest } = filterValues;
                setFilters(rest);
              } else {
                setFilters({ ...filterValues, "status@eq": status.id });
              }
            }}
          />
        ))}
      </FilterSection>

      {clients && clients.length > 0 && (
        <FilterSection icon={<User className="size-4" />} label="Cliente">
          <div className="w-full">
            <Popover open={clientOpen} onOpenChange={setClientOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Filtra per cliente"
                  className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <span className="truncate">
                    {filterValues["client_id@eq"]
                      ? (clients.find(
                          (c) => String(c.id) === filterValues["client_id@eq"],
                        )?.name ?? "Tutti")
                      : "Tutti"}
                  </span>
                  {filterValues["client_id@eq"] ? (
                    <X
                      className="size-3.5 shrink-0 opacity-50 hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        const { "client_id@eq": _, ...rest } = filterValues;
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
                  <CommandInput placeholder="Cerca cliente..." />
                  <CommandList>
                    <CommandEmpty>Nessun cliente</CommandEmpty>
                    <CommandGroup>
                      {clients.map((c) => (
                        <CommandItem
                          key={String(c.id)}
                          value={c.name}
                          onSelect={() => {
                            setFilters({
                              ...filterValues,
                              "client_id@eq": String(c.id),
                            });
                            setClientOpen(false);
                          }}
                        >
                          {c.name}
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

      <FilterSection icon={<Calendar className="size-4" />} label="Periodo">
        <DateRangeFilter
          fromKey="payment_date@gte"
          toKey="payment_date@lte"
          filterValues={filterValues}
          setFilters={setFilters}
        />
      </FilterSection>
    </div>
  );
};

