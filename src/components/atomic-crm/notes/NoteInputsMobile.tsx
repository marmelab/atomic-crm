import { useCallback, useRef } from "react";
import { required, useInput, useTranslate, ValidationError } from "ra-core";
import { RecordContextProvider } from "ra-core";
import { AutocompleteInput, ReferenceInput } from "@/components/admin";
import { FileInputPreview } from "@/components/admin/file-input";
import { useFormContext, useWatch } from "react-hook-form";

import { contactOptionText } from "../misc/ContactOption";
import { AttachmentField } from "./AttachmentField";
import { foreignKeyMapping } from "./foreignKeyMapping";
import { validateNoteOrAttachmentRequired } from "./noteModel";

export const NoteInputsMobile = ({
  selectContact,
}: {
  selectContact?: boolean;
}) => {
  const translate = useTranslate();
  const { field, fieldState } = useInput({
    source: "text",
    validate: validateNoteOrAttachmentRequired,
  });
  const fieldRefCallback = useRef(field.ref);
  fieldRefCallback.current = field.ref;

  const textareaRef = useCallback((node: HTMLTextAreaElement | null) => {
    fieldRefCallback.current(node);
    if (!node) return;
    requestAnimationFrame(() => {
      node.focus();
      node.setSelectionRange(node.value.length, node.value.length);
    });
  }, []);

  return (
    <div className="flex flex-col flex-1 -m-4">
      <div className="flex-1 flex flex-col">
        <textarea
          {...field}
          ref={textareaRef}
          placeholder={translate("resources.notes.inputs.add_note")}
          className="flex-1 min-h-0 resize-none bg-background p-4 touch-auto outline-none text-base"
        />
        {fieldState.error && (
          <p className="px-4 text-sm text-destructive">
            <ValidationError error={fieldState.error.message ?? ""} />
          </p>
        )}
      </div>
      {selectContact && (
        <div className="px-4">
          <ReferenceInput
            source={foreignKeyMapping["contacts"]}
            reference="contacts"
          >
            <AutocompleteInput
              label="resources.notes.fields.contact_id"
              optionText={contactOptionText}
              helperText={false}
              validate={required()}
              modal
            />
          </ReferenceInput>
        </div>
      )}
      <div className="px-4">
        <AttachmentPreviewsMobile />
      </div>
    </div>
  );
};

const AttachmentPreviewsMobile = () => {
  const { control, setValue } = useFormContext();
  const attachments = useWatch({ control, name: "attachments" });

  if (!Array.isArray(attachments) || attachments.length === 0) return null;

  const onRemove = (index: number) => {
    const updated = attachments.filter((_: unknown, i: number) => i !== index);
    setValue("attachments", updated, { shouldDirty: true });
  };

  return (
    <div className="flex flex-col gap-1">
      {attachments.map((file: Record<string, unknown>, index: number) => (
        <FileInputPreview
          key={index}
          file={file}
          onRemove={() => onRemove(index)}
        >
          <RecordContextProvider value={file}>
            <AttachmentField source="src" title="title" target="_blank" />
          </RecordContextProvider>
        </FileInputPreview>
      ))}
    </div>
  );
};
