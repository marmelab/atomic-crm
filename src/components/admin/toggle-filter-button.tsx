import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useListContext, useTranslate } from "ra-core";
import matches from "lodash/matches";
import pickBy from "lodash/pickBy";
import { CircleX } from "lucide-react";

export const ToggleFilterButton = ({
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
  return (
    <Button
      variant={isSelected ? "secondary" : "ghost"}
      onClick={handleClick}
      className={cn(
        "cursor-pointer",
        "flex flex-row items-center justify-between gap-2 px-2.5 w-full",
        className,
      )}
      size={size}
    >
      {typeof label === "string" ? translate(label, { _: label }) : label}
      {isSelected && <CircleX className="opacity-50" />}
    </Button>
  );
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
