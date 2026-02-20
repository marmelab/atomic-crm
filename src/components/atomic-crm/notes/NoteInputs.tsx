import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { TextInput } from "@/components/admin/text-input";
import { FileInput } from "@/components/admin/file-input";
import { SelectInput } from "@/components/admin/select-input";
import { DateTimeInput } from "@/components/admin/date-time-input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { Status } from "../misc/Status";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { getCurrentDate } from "./utils";
import { AttachmentField } from "./AttachmentField";
import { foreignKeyMapping } from "./foreignKeyMapping";
import { AutocompleteInput, ReferenceInput } from "@/components/admin";
import { required } from "ra-core";
import { contactOptionText } from "../misc/ContactOption";
import { useIsMobile } from "@/hooks/use-mobile";

export const NoteInputs = ({
  showStatus,
  selectReference,
  reference,
}: {
  showStatus?: boolean;
  selectReference?: boolean;
  reference?: "contacts" | "deals";
}) => {
  const isMobile = useIsMobile();
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
        rows={6}
      />

      {selectReference && reference && (
        <ReferenceInput
          source={foreignKeyMapping[reference]}
          reference={reference}
        >
          <AutocompleteInput
            label={reference === "contacts" ? "Contact" : "Deal"}
            optionText={
              reference === "contacts" ? contactOptionText : undefined
            }
            helperText={false}
            validate={required()}
          />
        </ReferenceInput>
      )}

      {!displayMore && !isMobile && (
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
          "space-y-3 mt-3 overflow-hidden origin-top",
          !isMobile ? "transition-transform ease-in-out duration-300 " : "",
          !displayMore && !isMobile ? "scale-y-0 max-h-0 h-0" : "scale-y-100",
        )}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <DateTimeInput
            source="date"
            label="Date"
            helperText={false}
            className="text-primary"
            defaultValue={getCurrentDate()}
          />
        </div>
        <FileInput source="attachments" multiple>
          <AttachmentField source="src" title="title" target="_blank" />
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
