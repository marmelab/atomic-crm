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
import { Input } from "@/components/ui/input";
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
  Receipt,
  FolderOpen,
  User,
  Building2,
  Calendar,
  ChevronsUpDown,
  X,
  Filter,
} from "lucide-react";

import type { Client, Project, Supplier } from "../types";
import { DateRangeFilter } from "../filters/DateRangeFilter";
import { expenseTypeChoices } from "./expenseTypes";

/* ---- Desktop sidebar ---- */
export const ExpenseListFilter = () => (
  <div className="shrink-0 w-56 order-last hidden md:block">
    <ExpenseFilterContent />
  </div>
);

/* ---- Mobile Sheet filter ---- */
export const ExpenseMobileFilter = () => {
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
          <ExpenseFilterContent />
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
const ExpenseFilterContent = () => {
  const { filterValues, setFilters } = useListFilterContext();
  const [clientOpen, setClientOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [supplierOpen, setSupplierOpen] = useState(false);

  const { data: clients } = useGetList<Client>("clients", {
    pagination: { page: 1, perPage: 200 },
    sort: { field: "name", order: "ASC" },
  });

  const { data: projects } = useGetList<Project>("projects", {
    pagination: { page: 1, perPage: 200 },
    sort: { field: "name", order: "ASC" },
  });

  const { data: suppliers } = useGetList<Supplier>("suppliers", {
    pagination: { page: 1, perPage: 200 },
    sort: { field: "name", order: "ASC" },
  });

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
          placeholder="Cerca descrizione..."
          className="pl-8"
          value={
            (filterValues["description@ilike"] as string)?.replace(/%/g, "") ??
            ""
          }
          onChange={handleSearchChange}
        />
      </div>

      <FilterSection icon={<Receipt className="size-4" />} label="Tipo spesa">
        {expenseTypeChoices.map((type) => (
          <FilterBadge
            key={type.id}
            label={type.name}
            isActive={filterValues["expense_type@eq"] === type.id}
            onToggle={() => {
              if (filterValues["expense_type@eq"] === type.id) {
                const { "expense_type@eq": _, ...rest } = filterValues;
                setFilters(rest);
              } else {
                setFilters({
                  ...filterValues,
                  "expense_type@eq": type.id,
                });
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

      {suppliers && suppliers.length > 0 && (
        <FilterSection icon={<Building2 className="size-4" />} label="Fornitore">
          <div className="w-full">
            <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Filtra per fornitore"
                  className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <span className="truncate">
                    {filterValues["supplier_id@eq"]
                      ? (suppliers.find(
                          (s) => String(s.id) === filterValues["supplier_id@eq"],
                        )?.name ?? "Tutti")
                      : "Tutti"}
                  </span>
                  {filterValues["supplier_id@eq"] ? (
                    <X
                      className="size-3.5 shrink-0 opacity-50 hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        const { "supplier_id@eq": _, ...rest } = filterValues;
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
                  <CommandInput placeholder="Cerca fornitore..." />
                  <CommandList>
                    <CommandEmpty>Nessun fornitore</CommandEmpty>
                    <CommandGroup>
                      {suppliers.map((s) => (
                        <CommandItem
                          key={String(s.id)}
                          value={s.name}
                          onSelect={() => {
                            setFilters({
                              ...filterValues,
                              "supplier_id@eq": String(s.id),
                            });
                            setSupplierOpen(false);
                          }}
                        >
                          {s.name}
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
          fromKey="expense_date@gte"
          toKey="expense_date@lte"
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
