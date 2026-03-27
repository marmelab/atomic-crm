import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Status } from "../misc/Status";
import { useConfigurationContext } from "../root/ConfigurationContext";

type StatusSelectorProps = {
  disabled?: boolean;
  status?: string;
  setStatus: (status: string) => void;
  triggerClassName?: string;
};

export const StatusSelector = ({
  disabled,
  status,
  setStatus,
  triggerClassName,
}: StatusSelectorProps) => {
  const { noteStatuses } = useConfigurationContext();

  const currentStatus = noteStatuses.find((s) => s.value === status);

  return (
    <Select disabled={disabled} value={status} onValueChange={setStatus}>
      <SelectTrigger className={cn("w-32", triggerClassName)}>
        <SelectValue>
          {currentStatus && (
            <div className="flex items-center gap-2">
              <Status status={currentStatus.value} />
              {currentStatus.label}
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {noteStatuses.map((statusOption) => (
          <SelectItem key={statusOption.value} value={statusOption.value}>
            <div className="flex items-center gap-2">
              <Status status={statusOption.value} />
              {statusOption.label}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
