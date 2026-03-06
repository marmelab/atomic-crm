import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export type SectionColor =
  | "slate"
  | "indigo"
  | "blue"
  | "emerald"
  | "amber"
  | "violet";

const sectionDotClasses: Record<SectionColor, string> = {
  slate: "bg-slate-400",
  indigo: "bg-indigo-500",
  blue: "bg-blue-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  violet: "bg-violet-500",
};

const sectionTextClasses: Record<SectionColor, string> = {
  slate: "text-slate-500",
  indigo: "text-indigo-600",
  blue: "text-blue-600",
  emerald: "text-emerald-600",
  amber: "text-amber-600",
  violet: "text-violet-600",
};

export const Field = ({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={cn("space-y-2", className)}>
    <Label>{label}</Label>
    {children}
  </div>
);

export const SelectField = ({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) => (
  <select
    value={value}
    onChange={(event) => onChange(event.target.value)}
    className="border-input focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
  >
    {children}
  </select>
);

const SectionDot = ({ color }: { color?: SectionColor }) =>
  color ? (
    <span
      className={cn("size-2.5 shrink-0 rounded-full", sectionDotClasses[color])}
    />
  ) : null;

export const Section = ({
  title,
  color,
  children,
}: {
  title: string;
  color?: SectionColor;
  children: React.ReactNode;
}) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2">
      <SectionDot color={color} />
      <span
        className={cn(
          "text-xs font-semibold uppercase tracking-wide",
          color ? sectionTextClasses[color] : "text-muted-foreground",
        )}
      >
        {title}
      </span>
      <Separator className="flex-1" />
    </div>
    <div className="grid gap-3 md:grid-cols-2">{children}</div>
  </div>
);

export const CollapsibleSection = ({
  title,
  color,
  defaultOpen,
  children,
}: {
  title: string;
  color?: SectionColor;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) => {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center gap-2 text-left"
      >
        {open ? (
          <ChevronDown className="size-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3.5 text-muted-foreground" />
        )}
        <SectionDot color={color} />
        <span
          className={cn(
            "text-xs font-semibold uppercase tracking-wide",
            color ? sectionTextClasses[color] : "text-muted-foreground",
          )}
        >
          {title}
        </span>
        <Separator className="flex-1" />
      </button>
      {open ? (
        <div className="grid gap-3 md:grid-cols-2">{children}</div>
      ) : null}
    </div>
  );
};
