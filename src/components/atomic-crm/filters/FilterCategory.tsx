import { Translate } from "ra-core";
import type { ReactNode } from "react";

export const FilterCategory = ({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children?: ReactNode;
}) => (
  <div className="flex flex-col gap-2 pb-3 border-b border-border last:border-b-0 last:pb-0">
    <h3 className="flex flex-row items-center gap-2 font-bold text-sm">
      {icon}
      <Translate i18nKey={label} />
    </h3>
    <div className="flex md:flex-col flex-wrap items-start pl-4">
      {children}
    </div>
  </div>
);
