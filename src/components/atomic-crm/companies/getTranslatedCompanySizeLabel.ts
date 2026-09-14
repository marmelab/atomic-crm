type TranslateFn = (key: string, options?: { [key: string]: any }) => string;

const defaultCompanySizeLabels: Record<number, string> = {
  50: "Fewer than 50 employees",
  100: "50-100 employees",
  250: "100-250 employees",
  500: "250-500 employees",
  1000: "More than 500 employees",
};

const companySizeTranslationKeys: Record<number, string> = {
  50: "resources.companies.sizes.fewer_than_fifty_employees",
  100: "resources.companies.sizes.fifty_to_one_hundred_employees",
  250: "resources.companies.sizes.one_hundred_to_two_hundred_fifty_employees",
  500: "resources.companies.sizes.two_hundred_fifty_to_five_hundred_employees",
  1000: "resources.companies.sizes.more_than_five_hundred_employees",
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
