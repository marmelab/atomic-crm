import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Status } from "../misc/Status";
import { useConfigurationContext } from "../root/ConfigurationContext";

export const StatusSelector = ({ status, setStatus }: any) => {
  const { noteStatuses } = useConfigurationContext();

  const currentStatus = noteStatuses.find((s) => s.value === status);

  return (
    <Select value={status} onValueChange={setStatus}>
      <SelectTrigger className="w-32">
        <SelectValue>
          {currentStatus && (
            <div className="flex items-center gap-2">
              {currentStatus.label} <Status status={currentStatus.value} />
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {noteStatuses.map((statusOption) => (
          <SelectItem key={statusOption.value} value={statusOption.value}>
            <div className="flex items-center gap-2">
              {statusOption.label} <Status status={statusOption.value} />
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
