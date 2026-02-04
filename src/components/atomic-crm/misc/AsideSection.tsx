import type { ReactNode } from "react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

export type AsideSectionProps = {
  title: string;
  children?: ReactNode;
  noGap?: boolean;
};

export function AsideSection({ title, children, noGap }: AsideSectionProps) {
  const isMobile = useIsMobile();
  return (
    <div className="mb-6 text-sm">
      <h3 className={isMobile ? "text-lg font-semibold" : "font-medium pb-1"}>
        {title}
      </h3>
      <Separator />
      <div className={cn("pt-2 flex flex-col", { "gap-1": !noGap })}>
        {children}
      </div>
    </div>
  );
}
