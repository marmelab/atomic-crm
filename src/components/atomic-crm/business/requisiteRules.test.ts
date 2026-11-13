import { describe, expect, it } from "vitest";

import {
  compactRequisites,
  findInvalidRequisites,
  findMissingRequisites,
} from "./requisiteRules";
import type { RequisiteField } from "./types";

const field = (
  key: string,
  validator: RequisiteField["validator"],
  extra: Partial<RequisiteField> = {},
): RequisiteField => ({
  key,
  validator,
  label: key,
  required: false,
  required_group: null,
  sort_order: 0,
  ...extra,
});

const ukraine = [
  field("edrpou", "edrpou", { required_group: "tax_id" }),
  field("ipn", "ipn", { required_group: "tax_id" }),
  field("iban", "iban"),
];
const poland = [
  field("nip", "nip", { required: true }),
  field("regon", "regon"),
];

describe("requisite rules", () => {
  it("asks a Ukrainian business for an EDRPOU code or an individual tax number", () => {
    expect(findMissingRequisites(ukraine, {})).toEqual(["tax_id"]);
    expect(findMissingRequisites(ukraine, { ipn: "3000000008" })).toEqual([]);
  });

  it("asks a Polish business for its NIP", () => {
    expect(findMissingRequisites(poland, { regon: "610188201" })).toEqual([
      "nip",
    ]);
  });

  it("flags only filled values with wrong check digits", () => {
    expect(
      findInvalidRequisites(poland, { nip: "7740001455", regon: "" }),
    ).toEqual(["nip"]);
    expect(findInvalidRequisites(poland, { nip: "774-000-14-54" })).toEqual([]);
  });

  it("drops empty values before saving", () => {
    expect(compactRequisites({ nip: " 7740001454 ", regon: "  " })).toEqual({
      nip: "7740001454",
    });
  });
});
