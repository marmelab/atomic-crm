import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useConfigurationContext } from "../root/ConfigurationContext";
import { Translate, useTranslate } from "ra-core";

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
  const translate = useTranslate();

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
        <SelectValue
          placeholder={translate("resources.contacts.background.status_none", {
            _: "None",
          })}
        />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_VALUE}>
          <Translate i18nKey="resources.contacts.background.status_none">
            None
          </Translate>
        </SelectItem>
        {noteStatuses.map((statusOption) => (
          <SelectItem key={statusOption.value} value={statusOption.value}>
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: statusOption.color }}
              />
              {statusOption.label}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
