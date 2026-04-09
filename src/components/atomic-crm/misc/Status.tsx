import { cn } from "@/lib/utils";

import { useConfigurationContext } from "../root/ConfigurationContext";

export const Status = ({
  status,
  className,
  showLabel = false,
}: {
  status: string;
  className?: string;
  showLabel?: boolean;
}) => {
  const { noteStatuses } = useConfigurationContext();
  if (!status || !noteStatuses) return null;
  const statusObject = noteStatuses.find((s: any) => s.value === status);

  if (!statusObject) return null;
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium",
        className,
      )}
      style={{
        backgroundColor: `${statusObject.color}20`,
        color: statusObject.color,
      }}
    >
      <span
        className="inline-block w-2 h-2 rounded-full"
        style={{ backgroundColor: statusObject.color }}
      />
      {showLabel && <span>{statusObject.label}</span>}
    </div>
  );
};
