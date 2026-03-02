import { contactGenderDefaultLabels } from "./contactGender";

type TranslateFn = (key: string, options?: { [key: string]: any }) => string;

export const getTranslatedContactGenderLabel = (
  gender: { value: string; label: string },
  translate: TranslateFn,
) =>
  translate(gender.label, {
    _: contactGenderDefaultLabels[gender.value] ?? gender.label,
  });
