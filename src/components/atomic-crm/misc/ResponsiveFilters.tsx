import { useState } from "react";
import { FilterLiveForm } from "ra-core";
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

export const ResponsiveFilters = ({
  children,
  searchInput,
}: {
  children: React.ReactNode;
  searchInput?: Partial<SearchInputProps>;
}) => {
  const [open, setOpen] = useState(false);
  const {
    source = "q",
    className,
    ...otherSearchInputProps
  } = searchInput || {};
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <FilterLiveForm>
            <div className="mb-2">
              <SearchInput
                source={source}
                onClick={(event) => {
                  event.preventDefault();
                  setOpen(true);
                }}
                onKeyDown={(event) => {
                  event.preventDefault();
                }}
                className={className}
                {...otherSearchInputProps}
              />
            </div>
          </FilterLiveForm>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="max-h-screen overflow-y-auto p-4 flex flex-col gap-3"
        >
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <FilterLiveForm>
            <div className="mb-2">
              <SearchInput
                type="search"
                source={source}
                className={className}
                {...otherSearchInputProps}
              />
            </div>
          </FilterLiveForm>
          {children}
          <SheetFooter>
            <SheetClose asChild>
              <Button>Apply</Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div className="w-52 min-w-52 order-first pt-0.75 flex flex-col gap-4">
      <FilterLiveForm>
        <SearchInput
          source={source}
          onKeyDown={() => setOpen(false)}
          {...otherSearchInputProps}
        />
      </FilterLiveForm>

      {children}
    </div>
  );
};
