import { useState } from "react";
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
  const { setFilters } = useListContext();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <FilterLiveForm
            formComponent={(props) => <form className="flex-1" {...props} />}
          >
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
          </FilterLiveForm>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="h-screen overflow-y-auto p-4 flex flex-col gap-3"
        >
          <SheetHeader className="-p-4">
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
          <SheetFooter className="-p-4">
            <div className="flex w-full gap-4">
              <Button
                onClick={() => setFilters({}, [])}
                type="button"
                variant="secondary"
                className="flex-1"
              >
                Clear filters
              </Button>
              <SheetClose asChild>
                <Button className="flex-1">Apply</Button>
              </SheetClose>
            </div>
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
