import {
  fetchWithTimeout,
  type Connector,
  type ConnectorContext,
} from "../types.ts";

/**
 * VIES, the VAT number check of the European Commission (TZ section 5.1):
 * free, no key, returns the status, name and address of a company.
 *
 * VIES federates 27 national systems that are sometimes down, so the answer
 * has three statuses: "unavailable" (could not check) is not "invalid".
 */

export const VIES_URL =
  "https://ec.europa.eu/taxation_customs/vies/rest-api/ms";

/** Country prefixes VIES knows (Greece is EL, not GR). */
const VIES_COUNTRIES = new Set([
  "AT",
  "BE",
  "BG",
  "CY",
  "CZ",
  "DE",
  "DK",
  "EE",
  "EL",
  "ES",
  "FI",
  "FR",
  "HR",
  "HU",
  "IE",
  "IT",
  "LT",
  "LU",
  "LV",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SE",
  "SI",
  "SK",
  "XI",
]);

export interface VatCheckInput {
  /** ISO country code of the counterparty (GR is accepted for Greece) */
  countryCode: string;
  /** The number, with or without its country prefix, spaces or dashes */
  vatNumber: string;
}

export interface VatCheckResult {
  status: "valid" | "invalid" | "unavailable";
  /** Normalized VAT ID with its prefix: PL7740001454 */
  vatId: string;
  name?: string;
  /** Street line(s) */
  address?: string;
  zipcode?: string;
  city?: string;
  /** Why the check could not be done, for logs; never shown as is */
  reason?: string;
}

const viesCountry = (code: string): string =>
  code.toUpperCase() === "GR" ? "EL" : code.toUpperCase();

/** "PL 774-000-14-54" or "7740001454" for PL → "7740001454". */
export const normalizeVatNumber = (
  countryCode: string,
  vatNumber: string,
): string => {
  const compact = vatNumber.toUpperCase().replace(/[\s.-]/g, "");
  const prefix = viesCountry(countryCode);
  if (compact.startsWith(prefix)) return compact.slice(prefix.length);
  if (prefix === "EL" && compact.startsWith("GR")) return compact.slice(2);
  return compact;
};

/** VIES writes "---" for what a member state does not disclose. */
const disclosed = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed && trimmed !== "---" ? trimmed : undefined;
};

/**
 * "CHEMIKÓW 7\n09-411 PŁOCK" → street "CHEMIKÓW 7", zipcode "09-411",
 * city "PŁOCK". Formats vary by country: what is not recognized stays in
 * the street line.
 */
export const splitAddress = (
  address: string,
): Pick<VatCheckResult, "address" | "zipcode" | "city"> => {
  const lines = address
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const last = lines.at(-1) ?? "";
  const match = /^([A-Z]{0,2}-?\d[\d\s-]{2,8}\d)\s+(.+)$/i.exec(last);
  if (lines.length < 2 || !match) return { address: lines.join(", ") };
  return {
    address: lines.slice(0, -1).join(", "),
    zipcode: match[1].trim(),
    city: match[2].trim(),
  };
};

interface ViesResponse {
  isValid?: boolean;
  userError?: string;
  name?: string;
  address?: string;
}

export const checkVat = async (
  input: VatCheckInput,
  context: ConnectorContext,
): Promise<VatCheckResult> => {
  const country = viesCountry(input.countryCode);
  const number = normalizeVatNumber(input.countryCode, input.vatNumber);
  const vatId = `${input.countryCode.toUpperCase()}${number}`;

  if (!VIES_COUNTRIES.has(country)) {
    return { status: "unavailable", vatId, reason: "not an EU country" };
  }
  if (!/^[0-9A-Z+*]{2,12}$/.test(number)) {
    return { status: "invalid", vatId };
  }

  let body: ViesResponse;
  try {
    const response = await fetchWithTimeout(
      context,
      `${VIES_URL}/${country}/vat/${encodeURIComponent(number)}`,
      { headers: { Accept: "application/json" } },
    );
    if (!response.ok) {
      return {
        status: "unavailable",
        vatId,
        reason: `HTTP ${response.status}`,
      };
    }
    body = (await response.json()) as ViesResponse;
  } catch (error) {
    return {
      status: "unavailable",
      vatId,
      reason: error instanceof Error ? error.name : "network error",
    };
  }

  if (body.isValid === true) {
    const address = disclosed(body.address);
    return {
      status: "valid",
      vatId,
      name: disclosed(body.name),
      ...(address ? splitAddress(address) : {}),
    };
  }
  if (body.isValid === false && body.userError === "INVALID") {
    return { status: "invalid", vatId };
  }
  // MS_UNAVAILABLE, TIMEOUT, SERVICE_UNAVAILABLE, MS_MAX_CONCURRENT_REQ...
  return { status: "unavailable", vatId, reason: body.userError ?? "unknown" };
};

export const viesConnector: Connector<VatCheckInput, VatCheckResult> = {
  id: "vies",
  kind: "registry",
  call: checkVat,
};
