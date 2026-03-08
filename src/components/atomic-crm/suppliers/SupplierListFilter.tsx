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
import { FileBadge2, Filter, MapPin, Search } from "lucide-react";

import {
  getSupplierTextFilterValue,
  patchSupplierTextFilter,
} from "./supplierListFilters";
import { FilterSection } from "../filters/FilterHelpers";

/* ---- Desktop sidebar ---- */
export const SupplierListFilter = () => (
  <div className="shrink-0 w-56 order-last hidden md:block">
    <SupplierFilterContent />
  </div>
);

/* ---- Mobile Sheet filter ---- */
export const SupplierMobileFilter = () => {
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
          <SupplierFilterContent />
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
const SupplierFilterContent = () => {
  const { filterValues, setFilters } = useListFilterContext();

  const handleTextFilterChange =
    (field: "name" | "vat_number" | "fiscal_code" | "billing_city" | "email") =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFilters(
        patchSupplierTextFilter({
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
            value={getSupplierTextFilterValue(filterValues, "name")}
            onChange={handleTextFilterChange("name")}
          />
          <Input
            placeholder="Email"
            value={getSupplierTextFilterValue(filterValues, "email")}
            onChange={handleTextFilterChange("email")}
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
            value={getSupplierTextFilterValue(filterValues, "vat_number")}
            onChange={handleTextFilterChange("vat_number")}
          />
          <Input
            placeholder="Codice fiscale"
            value={getSupplierTextFilterValue(filterValues, "fiscal_code")}
            onChange={handleTextFilterChange("fiscal_code")}
          />
        </div>
      </FilterSection>

      <FilterSection icon={<MapPin className="size-4" />} label="Sede">
        <Input
          placeholder="Comune"
          value={getSupplierTextFilterValue(filterValues, "billing_city")}
          onChange={handleTextFilterChange("billing_city")}
        />
      </FilterSection>
    </div>
  );
};

