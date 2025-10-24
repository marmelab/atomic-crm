import * as React from "react";
import { cn } from "@/lib/utils.ts";

export interface TopToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export const TopToolbar = (inProps: TopToolbarProps) => {
  const { className, children, ...props } = inProps;

  return (
    <div
      className={cn(
        "flex flex-auto justify-end items-end gap-2 whitespace-nowrap",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export default TopToolbar;
