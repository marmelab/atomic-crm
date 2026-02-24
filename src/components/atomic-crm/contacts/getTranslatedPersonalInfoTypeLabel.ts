type TranslateFn = (key: string, options?: { [key: string]: any }) => string;

const personalInfoTypeMap: Record<string, string> = {
  Work: "work",
  Home: "home",
  Other: "other",
};

export const getTranslatedPersonalInfoTypeLabel = (
  type: string,
  translate: TranslateFn,
) =>
  translate(
    `crm.contacts.inputs.personal_info_types.${personalInfoTypeMap[type] ?? type.toLowerCase()}`,
    {
      _: type,
    },
  );
