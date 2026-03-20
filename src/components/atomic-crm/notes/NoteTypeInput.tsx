import { useInput } from "ra-core";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { useConfigurationContext } from "../root/ConfigurationContext";
import { NOTE_TYPE_ICONS } from "./NoteTypeBadge";

export const NoteTypeInput = ({
  defaultValue = "none",
}: {
  defaultValue?: string;
}) => {
  const { noteTypes } = useConfigurationContext();
  const { field } = useInput({ source: "type", defaultValue });

  const selected = noteTypes?.find((t) => t.value === field.value);
  const SelectedIcon = selected?.icon ? NOTE_TYPE_ICONS[selected.icon] : null;

  return (
    <Select
      key={`note-type:${field.value}`}
      value={field.value || "none"}
      onValueChange={field.onChange}
    >
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <SelectTrigger
              className="w-full transition-all"
              style={
                selected?.color && selected.value !== "none"
                  ? {
                      backgroundColor: selected.color + "22",
                      borderColor: selected.color + "88",
                      color: selected.color,
                    }
                  : undefined
              }
            >
              {SelectedIcon && selected?.value !== "none" ? (
                <span className="flex items-center justify-center w-5 h-5">
                  <SelectedIcon className="w-4 h-4" />
                </span>
              ) : (
                <SelectValue placeholder="—" />
              )}
            </SelectTrigger>
          </TooltipTrigger>
          {selected && selected.value !== "none" && (
            <TooltipContent side="top">
              <p>{selected.label}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>

      <SelectContent>
        {noteTypes?.map((noteType) => {
          const Icon = noteType.icon ? NOTE_TYPE_ICONS[noteType.icon] : null;
          return (
            <SelectItem key={noteType.value} value={noteType.value}>
              <span className="flex items-center gap-2">
                {Icon ? (
                  <span
                    style={
                      noteType.color ? { color: noteType.color } : undefined
                    }
                  >
                    <Icon className="w-4 h-4" />
                  </span>
                ) : (
                  <span className="w-4 h-4" />
                )}
                {noteType.label}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
};
