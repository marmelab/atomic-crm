import { useRef, useState } from "react";
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
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const TIMEOUT_DURATION_IN_SECONDS = 0.5;

export const ResponsiveFilters = ({
  children,
  searchInput,
}: {
  children: React.ReactNode;
  searchInput: Partial<SearchInputProps>;
}) => {
  const [open, setOpen] = useState(false);
  const { source = "q", className, ...otherSearchInputProps } = searchInput;
  const isMobile = useIsMobile();
  const dialogContentRef = useRef<HTMLDivElement>(null);

  if (isMobile) {
    return (
      <Drawer open={open} onClose={() => setOpen(false)} modal={false}>
        <DrawerTrigger asChild>
          <FilterLiveForm>
            <SearchInput
              type="search"
              source={source}
              onClick={(event) => {
                setOpen(true);
                setTimeout(() => {
                  if (!dialogContentRef.current) return;
                  const input = event.target as HTMLInputElement;
                  dialogContentRef.current.style.top =
                    input.getBoundingClientRect().bottom +
                    input.clientTop +
                    7 +
                    "px";
                }, TIMEOUT_DURATION_IN_SECONDS);
              }}
              onKeyDown={() => setOpen(false)}
              className={cn("pb-2", className)}
              {...otherSearchInputProps}
            />
          </FilterLiveForm>
        </DrawerTrigger>
        <DrawerContent
          ref={dialogContentRef}
          className="data-[vaul-drawer-direction='bottom']:mt-0! data-[vaul-drawer-direction='bottom']:max-h-none! p-2 flex flex-col gap-4"
        >
          <DrawerHeader className="sr-only">
            <DrawerTitle>Filters</DrawerTitle>
          </DrawerHeader>
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
