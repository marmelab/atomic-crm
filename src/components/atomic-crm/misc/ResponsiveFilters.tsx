import { FilterLiveForm, useListContext } from "ra-core";
import { SearchInput, type SearchInputProps } from "@/components/admin";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Filter } from "lucide-react";

const FlexForm = (props: React.FormHTMLAttributes<HTMLFormElement>) => (
  <form className="flex-1" {...props} />
);

export const ResponsiveFilters = ({
  children,
  searchInput,
}: {
  children: React.ReactNode;
  searchInput?: Partial<SearchInputProps>;
}) => {
  const {
    source = "q",
    className,
    ...otherSearchInputProps
  } = searchInput || {};
  const isMobile = useIsMobile();
  const { setFilters, filterValues } = useListContext();

  // Count active filters excluding the search filter
  const activeFiltersCount = Object.entries(filterValues || {}).filter(
    ([key]) => key !== source,
  ).length;

  const handleClearFilters = () => {
    // Preserve only the search filter
    const searchValue = filterValues[source];
    const preservedFilters = searchValue ? { [source]: searchValue } : {};
    setFilters(preservedFilters, []);
  };

  if (isMobile) {
    return (
      <div className="flex flex-1 gap-2">
        <FilterLiveForm formComponent={FlexForm}>
          <SearchInput
            source={source}
            className={className}
            {...otherSearchInputProps}
          />
        </FilterLiveForm>
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative size-9"
              aria-label="Filter"
            >
              <Filter className="size-5" />
              {activeFiltersCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs flex items-center justify-center"
                >
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-dvh p-4 flex flex-col">
            <SheetHeader className="-p-4">
              <SheetTitle>
                <h1 className="text-xl font-semibold">Filters</h1>
              </SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto flex flex-col gap-3 pb-4">
              {children}
            </div>
            <SheetFooter className="-p-4 relative">
              <div className="absolute -top-12 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none" />
              <div className="flex w-full gap-4">
                <SheetClose asChild>
                  <Button
                    onClick={handleClearFilters}
                    type="button"
                    variant="secondary"
                    className="flex-1"
                  >
                    Clear filters
                  </Button>
                </SheetClose>
                <SheetClose asChild>
                  <Button className="flex-1">Apply</Button>
                </SheetClose>
              </div>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  return (
    <div className="w-52 min-w-52 order-first pt-0.75 flex flex-col gap-4">
      <FilterLiveForm>
        <SearchInput source={source} {...otherSearchInputProps} />
      </FilterLiveForm>
      {children}
    </div>
  );
};
