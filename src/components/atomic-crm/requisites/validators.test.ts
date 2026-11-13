import { describe, expect, it } from "vitest";

import { isValidRequisite, normalizeRequisite } from "./validators";

// Valid samples are real published identifiers (National Bank of Ukraine,
// PrivatBank, PKN Orlen, ZUS) or well-known IBAN examples; invalid ones change
// a single digit, which every check digit algorithm must catch.
describe("requisite validators", () => {
  it.each([
    ["edrpou", "14360570"],
    ["edrpou", "00032129"],
    ["edrpou", "40000006"],
    ["ipn", "3000000008"],
    ["ipn", "1234567899"],
    ["nip", "7740001454"],
    ["nip", "526-025-02-74"],
    ["regon", "610188201"],
    ["regon", "61018820100003"],
    ["iban", "UA213223130000026007233566001"],
    ["iban", "PL61 1090 1014 0000 0712 1981 2874"],
    ["iban", "pl61109010140000071219812874"],
  ] as const)("accepts a valid %s: %s", (validator, value) => {
    expect(isValidRequisite(validator, value)).toBe(true);
  });

  it.each([
    ["edrpou", "14360571", "wrong check digit"],
    ["edrpou", "1436057", "too short"],
    ["ipn", "3000000009", "wrong check digit"],
    ["nip", "7740001455", "wrong check digit"],
    ["nip", "77400014", "too short"],
    ["regon", "610188202", "wrong check digit"],
    ["regon", "61018820100004", "wrong long check digit"],
    ["iban", "PL61109010140000071219812875", "wrong check digits"],
    ["iban", "UA21322313000002600723356600", "wrong length for Ukraine"],
    ["iban", "RU0204452560040702810412345678901", "Russian bank account"],
    ["iban", "BY13NBRB3600900000002Z00AB00", "Belarusian bank account"],
    ["edrpou", "1436O570", "a letter instead of a digit"],
  ] as const)("rejects %s %s (%s)", (validator, value, _reason) => {
    expect(isValidRequisite(validator, value)).toBe(false);
  });

  it("normalizes what the user typed before storing it", () => {
    expect(normalizeRequisite("nip", " 774-000-14-54 ")).toBe("7740001454");
    expect(normalizeRequisite("iban", "pl61 1090 1014")).toBe("PL6110901014");
  });
});
