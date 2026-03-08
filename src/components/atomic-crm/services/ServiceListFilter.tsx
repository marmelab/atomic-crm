import { useMemo } from "react";
import { useListFilterContext, useGetList } from "ra-core";
import { Badge } from "@/components/ui/badge";
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
  Clapperboard,
  FolderOpen,
  FileText,
  Calendar,
  Filter,
  AlignLeft,
  Building2,
} from "lucide-react";

import type { Client, Project, Service } from "../types";
import { DateRangeFilter } from "../filters/DateRangeFilter";
import {
  FilterSection,
  FilterBadge,
  FilterPopover,
} from "../filters/FilterHelpers";
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
  const { serviceTypeChoices } = useConfigurationContext();

  const { data: clients } = useGetList<Client>("clients", {
    pagination: { page: 1, perPage: 200 },
    sort: { field: "name", order: "ASC" },
  });

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
    return Array.from(refs)
      .sort()
      .map((r) => ({ id: r, name: r }));
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

      {clients && clients.length > 0 && (
        <FilterSection icon={<Building2 className="size-4" />} label="Cliente">
          <FilterPopover
            items={clients}
            filterKey="client_id@eq"
            filterValues={filterValues}
            setFilters={setFilters}
            placeholder="Cerca cliente..."
            emptyLabel="Nessun cliente"
            ariaLabel="Filtra per cliente"
          />
        </FilterSection>
      )}

      {projects && projects.length > 0 && (
        <FilterSection
          icon={<FolderOpen className="size-4" />}
          label="Progetto"
        >
          <FilterPopover
            items={projects}
            filterKey="project_id@eq"
            filterValues={filterValues}
            setFilters={setFilters}
            placeholder="Cerca progetto..."
            emptyLabel="Nessun progetto"
            ariaLabel="Filtra per progetto"
          />
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
          <FilterPopover
            items={invoiceRefs}
            filterKey="invoice_ref@eq"
            filterValues={filterValues}
            setFilters={setFilters}
            placeholder="Cerca fattura..."
            emptyLabel="Nessuna fattura"
            allLabel="Tutte"
            ariaLabel="Filtra per fattura"
          />
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
