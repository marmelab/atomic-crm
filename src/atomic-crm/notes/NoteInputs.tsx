import { useState } from "react";
import { useFormContext } from "react-hook-form";

import { cn } from "@/lib/utils.ts";
import {
  TextInput,
  FileInput,
  FileField,
  SelectInput,
} from "@/components/admin";
import { Button } from "@/components/ui/button";
import { Status } from "../misc/Status";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { getCurrentDate } from "./utils";

export const NoteInputs = ({ showStatus }: { showStatus?: boolean }) => {
  const { noteStatuses } = useConfigurationContext();
  const { setValue } = useFormContext();
  const [displayMore, setDisplayMore] = useState(false);

  return (
    <div className="space-y-2">
      <TextInput
        source="text"
        label={false}
        multiline
        helperText={false}
        placeholder="Add a note"
      />

      {!displayMore && (
        <div className="flex justify-end items-center gap-2">
          <Button
            variant="link"
            size="sm"
            onClick={() => {
              setDisplayMore(!displayMore);
              setValue("date", getCurrentDate());
            }}
            className="text-sm text-muted-foreground underline hover:no-underline p-0 h-auto cursor-pointer"
          >
            Show options
          </Button>
          <span className="text-sm text-muted-foreground">
            (attach files, or change details)
          </span>
        </div>
      )}

      <div
        className={cn(
          "space-y-3 mt-3 overflow-hidden transition-transform ease-in-out duration-300 origin-top",
          !displayMore ? "scale-y-0 max-h-0 h-0" : "scale-y-100",
        )}
      >
        <div className="flex gap-4">
          {showStatus && (
            <SelectInput
              source="status"
              choices={noteStatuses.map((status) => ({
                id: status.value,
                name: status.label,
                value: status.value,
              }))}
              optionText={optionRenderer}
              defaultValue={"warm"}
              helperText={false}
            />
          )}
          <TextInput
            source="date"
            label="Date"
            helperText={false}
            type="datetime-local"
            className="text-primary"
            defaultValue={new Date().toISOString().slice(0, 16)}
          />
        </div>
        <FileInput source="attachments" multiple>
          <FileField source="src" title="title" target="_blank" />
        </FileInput>
      </div>
    </div>
  );
};

const optionRenderer = (choice: any) => {
  return (
    <div>
      <Status status={choice.value} /> {choice.name}
    </div>
  );
};
