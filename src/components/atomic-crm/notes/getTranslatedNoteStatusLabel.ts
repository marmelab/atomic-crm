import type { NoteStatus } from "../types";

type TranslateFn = (key: string, options?: { [key: string]: any }) => string;

const defaultNoteStatusLabels: Record<string, string> = {
  cold: "Cold",
  warm: "Warm",
  hot: "Hot",
  "in-contract": "In Contract",
};

const getStatusTranslationKey = (statusValue: string) =>
  `crm.notes.statuses.${statusValue.replaceAll("-", "_")}`;

export const getTranslatedNoteStatusLabel = (
  status: Pick<NoteStatus, "value" | "label">,
  translate: TranslateFn,
) => {
  const defaultLabel = defaultNoteStatusLabels[status.value];
  if (!defaultLabel || status.label !== defaultLabel) {
    return status.label;
  }

  return translate(getStatusTranslationKey(status.value), {
    _: status.label,
  });
};
