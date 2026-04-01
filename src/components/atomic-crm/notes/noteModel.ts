export const validateNoteOrAttachmentRequired = (
  value: string | null | undefined,
  values: { attachments?: unknown[] | null },
) => {
  const hasText = typeof value === "string" && value.trim().length > 0;
  const hasAttachments =
    Array.isArray(values?.attachments) && values.attachments.length > 0;

  return hasText || hasAttachments
    ? undefined
    : "resources.notes.validation.note_or_attachment_required";
};
