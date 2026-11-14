import type { Identifier } from "ra-core";

export interface CompanyDuplicate {
  id: Identifier;
  name: string;
  /** The requisite key that matched (edrpou, iban, nip...) or vat_id */
  matched: string;
}

export type VatStatus = "valid" | "invalid" | "unavailable";

/** Answer of the VIES connector (connectors/vies), as the server returns it */
export interface VatCheckResult {
  status: VatStatus;
  vatId: string;
  name?: string;
  address?: string;
  zipcode?: string;
  city?: string;
}
