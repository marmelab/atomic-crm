import type {
  FiscalConfig,
  FiscalTaxProfile,
} from "@/components/atomic-crm/types";

const normalizeAtecoCode = (value: string | null | undefined) => value?.trim();

export const getValidFiscalTaxProfiles = (
  taxProfiles: FiscalTaxProfile[] | null | undefined,
): FiscalTaxProfile[] =>
  (taxProfiles ?? []).filter((profile) => Boolean(normalizeAtecoCode(profile.atecoCode)));

export const getFirstValidFiscalTaxProfileAtecoCode = (
  taxProfiles: FiscalTaxProfile[] | null | undefined,
): string | null => getValidFiscalTaxProfiles(taxProfiles)[0]?.atecoCode ?? null;

export const isValidFiscalTaxProfileAtecoCode = (
  atecoCode: string | null | undefined,
  taxProfiles: FiscalTaxProfile[] | null | undefined,
): boolean => {
  const normalizedCode = normalizeAtecoCode(atecoCode);
  if (!normalizedCode) return false;
  return getValidFiscalTaxProfiles(taxProfiles).some(
    (profile) => profile.atecoCode === normalizedCode,
  );
};

export type FiscalFallbackProfileStatus = {
  isValid: boolean;
  selectedCode: string | null;
  firstValidCode: string | null;
  validProfiles: FiscalTaxProfile[];
  blockingMessage: string | null;
};

export const getFiscalFallbackProfileStatus = (
  fiscalConfig: Partial<FiscalConfig> | null | undefined,
): FiscalFallbackProfileStatus => {
  const validProfiles = getValidFiscalTaxProfiles(fiscalConfig?.taxProfiles);
  const firstValidCode = getFirstValidFiscalTaxProfileAtecoCode(validProfiles);
  const selectedCode =
    normalizeAtecoCode(fiscalConfig?.defaultTaxProfileAtecoCode) ?? null;

  if (!firstValidCode) {
    return {
      isValid: false,
      selectedCode,
      firstValidCode: null,
      validProfiles,
      blockingMessage:
        "Aggiungi almeno un profilo ATECO valido prima di salvare la configurazione fiscale.",
    };
  }

  if (!isValidFiscalTaxProfileAtecoCode(selectedCode, validProfiles)) {
    return {
      isValid: false,
      selectedCode,
      firstValidCode,
      validProfiles,
      blockingMessage:
        "Il profilo ATECO di fallback non e' valido. Selezionane uno presente nella lista dei profili.",
    };
  }

  return {
    isValid: true,
    selectedCode,
    firstValidCode,
    validProfiles,
    blockingMessage: null,
  };
};
