import { HttpError, type Identifier } from "ra-core";

import type { Requisites } from "../../business/types";
import type {
  CompanyDuplicate,
  VatCheckResult,
} from "../../counterparties/types";
import { getSupabaseClient } from "./supabase";

/** Counterparty lookups that a plain list query cannot express. */
export const counterpartyMethods = {
  /**
   * Counterparties of the current business sharing a tax number, IBAN or VAT
   * ID with the one being edited.
   */
  async findCompanyDuplicates(
    id: Identifier | null | undefined,
    requisites: Requisites,
    vatId: string | null | undefined,
  ): Promise<CompanyDuplicate[]> {
    const { data, error } = await getSupabaseClient().rpc(
      "company_duplicates",
      {
        p_id: id ?? null,
        p_requisites: requisites,
        p_vat_id: vatId ?? null,
      },
    );
    if (error) {
      throw new HttpError(
        error.message ?? "Failed to look for duplicates",
        400,
        error,
      );
    }
    return (data ?? []) as CompanyDuplicate[];
  },

  /** Checks an EU VAT number with VIES, through the vies_check function. */
  async checkVat(
    countryCode: string,
    vatNumber: string,
  ): Promise<VatCheckResult> {
    const { data, error } =
      await getSupabaseClient().functions.invoke<VatCheckResult>("vies_check", {
        method: "POST",
        body: { countryCode, vatNumber },
      });
    if (error || !data) {
      // The function itself could not be reached: same as VIES being down
      return { status: "unavailable", vatId: `${countryCode}${vatNumber}` };
    }
    return data;
  },
};
