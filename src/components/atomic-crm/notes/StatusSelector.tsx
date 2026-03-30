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

const NONE_VALUE = "__none__";

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

  /**
   * Radix's Select component doesn't allow empty string as value, so we use a placeholder value and convert it back to empty string on change
   * @see https://github.com/radix-ui/primitives/issues/2706
   */
  const handleValueChange = (value: string) => {
    setStatus(value === NONE_VALUE ? "" : value);
  };

  return (
    <Select
      disabled={disabled}
      value={status || NONE_VALUE}
      onValueChange={handleValueChange}
    >
      <SelectTrigger className={cn("w-32", triggerClassName)}>
        <SelectValue>
          {currentStatus ? (
            <div className="flex items-center gap-2">
              <Status status={currentStatus.value} />
              {currentStatus.label}
            </div>
          ) : (
            "None"
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_VALUE}>None</SelectItem>
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
