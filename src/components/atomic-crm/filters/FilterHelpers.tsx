import { useState } from "react";
import type React from "react";
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
import { ChevronsUpDown, X } from "lucide-react";

export const FilterSection = ({
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

export const FilterBadge = ({
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

export const FilterPopover = <T extends { id: unknown; name?: string }>({
  items,
  filterKey,
  filterValues,
  setFilters,
  placeholder,
  emptyLabel,
  allLabel = "Tutti",
  ariaLabel,
  displayValue,
}: {
  items: T[];
  filterKey: string;
  filterValues: Record<string, unknown>;
  setFilters: (filters: Record<string, unknown>) => void;
  placeholder: string;
  emptyLabel: string;
  allLabel?: string;
  ariaLabel: string;
  displayValue?: (item: T) => string;
}) => {
  const [open, setOpen] = useState(false);
  const getLabel = displayValue ?? ((item: T) => item.name ?? "");
  const selected = filterValues[filterKey] as string | undefined;
  const selectedLabel = selected
    ? (getLabel(items.find((i) => String(i.id) === selected) as T) ?? allLabel)
    : allLabel;

  return (
    <div className="w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={ariaLabel}
            className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          >
            <span className="truncate">{selectedLabel}</span>
            {selected ? (
              <X
                className="size-3.5 shrink-0 opacity-50 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  const { [filterKey]: _, ...rest } = filterValues;
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
            <CommandInput placeholder={placeholder} />
            <CommandList>
              <CommandEmpty>{emptyLabel}</CommandEmpty>
              <CommandGroup>
                {items.map((item) => (
                  <CommandItem
                    key={String(item.id)}
                    value={getLabel(item)}
                    onSelect={() => {
                      setFilters({ ...filterValues, [filterKey]: String(item.id) });
                      setOpen(false);
                    }}
                  >
                    {getLabel(item)}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};
