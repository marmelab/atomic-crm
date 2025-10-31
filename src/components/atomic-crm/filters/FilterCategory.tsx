import { Translate } from "ra-core";

export const FilterCategory = ({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children?: React.ReactNode;
}) => (
  <div className="flex flex-col gap-2">
    <h3 className="flex flex-row items-center gap-2 font-bold text-sm">
      {icon}
      <Translate i18nKey={label} />
    </h3>
    <div className="flex flex-col items-start pl-4">{children}</div>
  </div>
);
