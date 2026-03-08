import { useListFilterContext } from "ra-core";
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
  Building2,
  FileBadge2,
  Filter,
  MapPin,
  Megaphone,
  Search,
} from "lucide-react";

import { clientTypeChoices, clientSourceChoices } from "./clientTypes";
import {
  getClientTextFilterValue,
  patchClientTextFilter,
} from "./clientListFilters";
import { FilterSection, FilterBadge } from "../filters/FilterHelpers";

/* ---- Desktop sidebar ---- */
export const ClientListFilter = () => (
  <div className="shrink-0 w-56 order-last hidden md:block">
    <ClientFilterContent />
  </div>
);

/* ---- Mobile Sheet filter ---- */
export const ClientMobileFilter = () => {
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
          <ClientFilterContent />
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
const ClientFilterContent = () => {
  const { filterValues, setFilters } = useListFilterContext();

  const handleTextFilterChange =
    (
      field:
        | "name"
        | "billing_name"
        | "vat_number"
        | "fiscal_code"
        | "billing_city"
        | "billing_sdi_code"
        | "billing_pec",
    ) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFilters(
        patchClientTextFilter({
          filterValues,
          field,
          value: e.target.value,
        }),
      );
    };

  return (
    <div className="flex flex-col gap-6">
      <FilterSection icon={<Search className="size-4" />} label="Ricerca">
        <div className="space-y-2">
          <Input
            placeholder="Nome / ragione sociale"
            value={getClientTextFilterValue(filterValues, "name")}
            onChange={handleTextFilterChange("name")}
          />
          <Input
            placeholder="Denominazione fiscale"
            value={getClientTextFilterValue(filterValues, "billing_name")}
            onChange={handleTextFilterChange("billing_name")}
          />
        </div>
      </FilterSection>

      <FilterSection
        icon={<FileBadge2 className="size-4" />}
        label="Identificativi fiscali"
      >
        <div className="space-y-2">
          <Input
            placeholder="Partita IVA"
            value={getClientTextFilterValue(filterValues, "vat_number")}
            onChange={handleTextFilterChange("vat_number")}
          />
          <Input
            placeholder="Codice fiscale"
            value={getClientTextFilterValue(filterValues, "fiscal_code")}
            onChange={handleTextFilterChange("fiscal_code")}
          />
          <Input
            placeholder="Codice destinatario"
            value={getClientTextFilterValue(filterValues, "billing_sdi_code")}
            onChange={handleTextFilterChange("billing_sdi_code")}
          />
          <Input
            placeholder="PEC"
            value={getClientTextFilterValue(filterValues, "billing_pec")}
            onChange={handleTextFilterChange("billing_pec")}
          />
        </div>
      </FilterSection>

      <FilterSection icon={<MapPin className="size-4" />} label="Fatturazione">
        <Input
          placeholder="Comune fiscale"
          value={getClientTextFilterValue(filterValues, "billing_city")}
          onChange={handleTextFilterChange("billing_city")}
        />
      </FilterSection>

      <FilterSection
        icon={<Building2 className="size-4" />}
        label="Tipo cliente"
      >
        {clientTypeChoices.map((type) => (
          <FilterBadge
            key={type.id}
            label={type.name}
            isActive={filterValues["client_type@eq"] === type.id}
            onToggle={() => {
              if (filterValues["client_type@eq"] === type.id) {
                const { "client_type@eq": _, ...rest } = filterValues;
                setFilters(rest);
              } else {
                setFilters({
                  ...filterValues,
                  "client_type@eq": type.id,
                });
              }
            }}
          />
        ))}
      </FilterSection>

      <FilterSection icon={<Megaphone className="size-4" />} label="Fonte">
        {clientSourceChoices.map((source) => (
          <FilterBadge
            key={source.id}
            label={source.name}
            isActive={filterValues["source@eq"] === source.id}
            onToggle={() => {
              if (filterValues["source@eq"] === source.id) {
                const { "source@eq": _, ...rest } = filterValues;
                setFilters(rest);
              } else {
                setFilters({ ...filterValues, "source@eq": source.id });
              }
            }}
          />
        ))}
      </FilterSection>
    </div>
  );
};

