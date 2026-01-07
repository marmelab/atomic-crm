import { useState } from "react";
import { FilterLiveForm } from "ra-core";
import { SearchInput, type SearchInputProps } from "@/components/admin";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
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
      <Drawer open={open} onClose={() => setOpen(false)}>
        <DrawerTrigger asChild>
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
        </DrawerTrigger>
        <DrawerContent className="data-[vaul-drawer-direction='bottom']:mt-0! data-[vaul-drawer-direction='bottom']:max-h-none! p-2 flex flex-col gap-4">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Filters</DrawerTitle>
          </DrawerHeader>
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
          <DrawerFooter>
            <DrawerClose asChild>
              <Button>Apply</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
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
