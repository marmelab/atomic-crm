import { useEffect, useRef, useState } from "react";
import { required, useGetOne, useTranslate } from "ra-core";
import { TextInput } from "@/components/admin/text-input";
import { FileInput } from "@/components/admin/file-input";
import { SelectInput } from "@/components/admin/select-input";
import { DateTimeInput } from "@/components/admin/date-time-input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useFormContext, useWatch } from "react-hook-form";

import type { ContactNote, DealNote } from "../types";
import { Status } from "../misc/Status";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { getCurrentDate } from "./utils";
import { AttachmentField } from "./AttachmentField";
import { foreignKeyMapping } from "./foreignKeyMapping";
import { AutocompleteInput, ReferenceInput } from "@/components/admin";
import { contactOptionText } from "../misc/ContactOption";
import { validateNoteOrAttachmentRequired } from "./noteModel";

export const NoteInputs = ({
  defaultStatus,
  showStatus,
  selectReference,
  reference,
}: {
  defaultStatus?: string;
  showStatus?: boolean;
  selectReference?: boolean;
  reference?: "contacts" | "deals";
}) => {
  const { noteStatuses } = useConfigurationContext();
  const translate = useTranslate();
  const [displayMore, setDisplayMore] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { control, formState, setValue } = useFormContext<
    ContactNote | DealNote
  >();
  const selectedContactId = useWatch({ control, name: "contact_id" });
  const selectedStatus = useWatch({ control, name: "status" });
  const textValue = useWatch({ control, name: "text" as any });
  const isExpanded = isFocused || !!textValue;
  useEffect(() => {
    if (!textValue) {
      setIsFocused(false);
      const textarea = containerRef.current?.querySelector("textarea");
      if (textarea) {
        textarea.style.height = "";
      }
    }
  }, [textValue]);
  const shouldHydrateStatus =
    showStatus &&
    (defaultStatus !== undefined ||
      (reference === "contacts" && Boolean(selectReference)));
  const { data: selectedContact } = useGetOne(
    "contacts",
    { id: selectedContactId! },
    {
      enabled:
        shouldHydrateStatus &&
        reference === "contacts" &&
        Boolean(selectReference) &&
        selectedContactId != null,
    },
  );
  const resolvedDefaultStatus = shouldHydrateStatus
    ? reference === "contacts" && selectReference
      ? selectedContact?.status
      : defaultStatus
    : undefined;

  useEffect(() => {
    if (!shouldHydrateStatus || !resolvedDefaultStatus) return;
    if (
      formState.dirtyFields.status ||
      selectedStatus === resolvedDefaultStatus
    ) {
      return;
    }

    setValue("status", resolvedDefaultStatus, { shouldDirty: false });
  }, [
    formState.dirtyFields.status,
    resolvedDefaultStatus,
    selectedStatus,
    setValue,
    shouldHydrateStatus,
  ]);

  // We manually define the input labels because the default ones
  // would use the resource from the context, which is either "contact_notes" or "deal_notes",
  // but we want it to be "notes" regardless of the context
  return (
    <div ref={containerRef} className="space-y-2">
      <TextInput
        source="text"
        label={false}
        multiline
        helperText={false}
        placeholder={translate("resources.notes.inputs.add_note")}
        rows={2}
        inputClassName={cn(
          "transition-[min-height] duration-300 ease-in-out",
          isExpanded && "min-h-[20rem]",
        )}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        validate={validateNoteOrAttachmentRequired}
      />

      {selectReference && reference && (
        <ReferenceInput
          source={foreignKeyMapping[reference]}
          reference={reference}
        >
          <AutocompleteInput
            label={
              reference === "contacts"
                ? "resources.notes.fields.contact_id"
                : "resources.notes.fields.deal_id"
            }
            optionText={
              reference === "contacts" ? contactOptionText : undefined
            }
            helperText={false}
            validate={required()}
            modal
          />
        </ReferenceInput>
      )}

      {!displayMore && (
        <div className="flex justify-end items-center gap-2">
          <Button
            variant="link"
            size="sm"
            onClick={() => {
              setDisplayMore(!displayMore);
            }}
            className="text-sm text-muted-foreground underline hover:no-underline p-0 h-auto cursor-pointer"
          >
            {translate("resources.notes.inputs.show_options")}
          </Button>
          <span className="text-sm text-muted-foreground">
            {translate("resources.notes.inputs.options_hint")}
          </span>
        </div>
      )}

      <div
        className={cn(
          "space-y-3 mt-3 overflow-hidden origin-top",
          "transition-transform ease-in-out duration-300",
          !displayMore ? "scale-y-0 max-h-0 h-0" : "scale-y-100",
        )}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {showStatus && (
            <SelectInput
              source="status"
              label="resources.notes.fields.status"
              choices={noteStatuses.map((status) => ({
                id: status.value,
                name: status.label,
                value: status.value,
              }))}
              optionText={optionRenderer}
              defaultValue={resolvedDefaultStatus}
              helperText={false}
            />
          )}
          <DateTimeInput
            source="date"
            label="resources.notes.fields.date"
            helperText={false}
            className="text-primary"
            defaultValue={getCurrentDate()}
          />
        </div>
        <FileInput
          source="attachments"
          label="resources.notes.fields.attachments"
          multiple
        >
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
