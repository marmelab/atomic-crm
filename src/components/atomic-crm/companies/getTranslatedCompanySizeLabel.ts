type TranslateFn = (key: string, options?: { [key: string]: any }) => string;

const defaultCompanySizeLabels: Record<number, string> = {
  1: "1 employee",
  10: "2-9 employees",
  50: "10-49 employees",
  250: "50-249 employees",
  500: "250 or more employees",
};

const companySizeTranslationKeys: Record<number, string> = {
  1: "crm.companies.sizes.one_employee",
  10: "crm.companies.sizes.two_to_nine_employees",
  50: "crm.companies.sizes.ten_to_forty_nine_employees",
  250: "crm.companies.sizes.fifty_to_two_hundred_forty_nine_employees",
  500: "crm.companies.sizes.two_hundred_fifty_or_more_employees",
};

export const getTranslatedCompanySizeLabel = (
  size: { id: number; name: string },
  translate: TranslateFn,
) => {
  const defaultLabel = defaultCompanySizeLabels[size.id];
  const translationKey = companySizeTranslationKeys[size.id];
  if (!defaultLabel || !translationKey || size.name !== defaultLabel) {
    return size.name;
  }

  return translate(translationKey, { _: size.name });
};
