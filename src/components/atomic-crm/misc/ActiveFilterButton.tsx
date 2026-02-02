import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useListContext, useTranslate } from "ra-core";
import matches from "lodash/matches";
import pickBy from "lodash/pickBy";
import { CircleX } from "lucide-react";

/**
 * A button that renders only if a specific filter is on, and allows to remove the filter.
 *
 * @example
 * import { ActiveFilterButton } from '@/components/atomic-crm/misc';
 *
 * const PostFilters = () => (
 *   <div className="flex flex-row gap-2">
 *     <ActiveFilterButton label="Published" value={{ status: 'published' }} />
 *     <ActiveFilterButton label="Draft" value={{ status: 'draft' }} />
 *   </div>
 * );
 */
export const ActiveFilterButton = ({
  label,
  size = "sm",
  value,
  className,
}: {
  label: React.ReactElement | string;
  value: any;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon" | null | undefined;
}) => {
  const { filterValues, setFilters } = useListContext();
  const translate = useTranslate();
  const isSelected = getIsSelected(value, filterValues);
  const handleClick = () => setFilters(toggleFilter(value, filterValues));
  return isSelected ? (
    <Button
      variant="secondary"
      onClick={handleClick}
      className={cn(
        "cursor-pointer",
        "flex flex-row items-center justify-between gap-2 px-2 w-full h-8",
        className,
      )}
      size={size}
    >
      {typeof label === "string" ? translate(label, { _: label }) : label}
      <CircleX className="opacity-50" />
    </Button>
  ) : null;
};

const toggleFilter = (value: any, filters: any) => {
  const isSelected = matches(
    pickBy(value, (val) => typeof val !== "undefined"),
  )(filters);

  if (isSelected) {
    const keysToRemove = Object.keys(value);
    return Object.keys(filters).reduce(
      (acc, key) =>
        keysToRemove.includes(key) ? acc : { ...acc, [key]: filters[key] },
      {},
    );
  }

  return { ...filters, ...value };
};

const getIsSelected = (value: any, filters: any) =>
  matches(pickBy(value, (val) => typeof val !== "undefined"))(filters);
