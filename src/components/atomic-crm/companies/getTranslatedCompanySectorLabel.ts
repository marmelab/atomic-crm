type TranslateFn = (key: string, options?: { [key: string]: any }) => string;

const defaultCompanySectorLabels: Record<string, string> = {
  "communication-services": "Communication Services",
  "consumer-discretionary": "Consumer Discretionary",
  "consumer-staples": "Consumer Staples",
  energy: "Energy",
  financials: "Financials",
  "health-care": "Health Care",
  industrials: "Industrials",
  "information-technology": "Information Technology",
  materials: "Materials",
  "real-estate": "Real Estate",
  utilities: "Utilities",
};

const getCompanySectorTranslationKey = (sectorValue: string) =>
  `crm.companies.sectors.${sectorValue.replaceAll("-", "_")}`;

export const getTranslatedCompanySectorLabel = (
  sector: { value: string; label: string },
  translate: TranslateFn,
) => {
  const defaultLabel = defaultCompanySectorLabels[sector.value];
  if (!defaultLabel || sector.label !== defaultLabel) {
    return sector.label;
  }

  return translate(getCompanySectorTranslationKey(sector.value), {
    _: sector.label,
  });
};
