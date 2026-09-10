import type { DataProvider, Identifier } from "ra-core";

import type { Cohort, Contact, Deal, OfferPaymentOption } from "../types";

// Payment domain foundation slice: the public Offer Page's own read-side
// context — only the handful of fields a prospect is allowed to see
// (their own name, the frozen offer/price, which payment option(s) they
// may choose among), never internal ids, sales notes, or anyone else's
// data. Mirrors public-application/publicOfferContext.ts's own shape and
// its own header comment: this is the FakeRest-testable "logic of record"
// a production Edge Function mirrors by hand (RLS blocks an anon client
// from reading "deals"/"contacts"/etc. directly — every table's RLS is
// `to authenticated` only, same as every other public-facing surface in
// this app).
export type OfferPagePaymentOption = {
  id: Identifier;
  name: string;
  total: number;
  installments: number;
  installmentAmount: number;
};

export type PublicOfferPageContext =
  | { kind: "not-found" }
  | {
      kind: "found";
      contactName: string;
      offerName: string;
      cohortName: string | null;
      frozenPrice: number;
      // Scholarship Pricing + Capacity slice: lets the Offer Page clearly
      // identify scholarship pricing to the prospect — offerName itself
      // never encodes pricing mode (see offers.scholarship_price's own
      // schema comment: pricing_mode carries that identity, not the Offer
      // name).
      isScholarship: boolean;
      // Exactly one entry when Leif has already authorized a specific
      // option for this Deal (selected_payment_option_id set); every
      // publicly-offered option of this Deal's Offer otherwise — see
      // offer_payment_options.is_public's own schema comment for why a
      // prospect only ever sees a subset by default.
      paymentOptions: OfferPagePaymentOption[];
      // Lets the page show "you've already completed this" instead of a
      // stale payment CTA on a revisit — never exposes anything the
      // prospect doesn't already know.
      alreadyWon: boolean;
    };

export const getOfferPageContext = async (
  dataProvider: DataProvider,
  token: string,
): Promise<PublicOfferPageContext> => {
  const { data: deals } = await dataProvider.getList<Deal>("deals", {
    filter: { offer_page_token: token },
    pagination: { page: 1, perPage: 1 },
    sort: { field: "id", order: "ASC" },
  });
  const deal = deals[0];
  if (!deal || deal.offer_price_snapshot == null) return { kind: "not-found" };

  const contact = await dataProvider
    .getOne<Contact>("contacts", { id: deal.contact_id! })
    .then(({ data }) => data)
    .catch(() => null);
  if (!contact) return { kind: "not-found" };

  const cohort =
    deal.cohort_id != null
      ? await dataProvider
          .getOne<Cohort>("cohorts", { id: deal.cohort_id })
          .then(({ data }) => data)
          .catch(() => null)
      : null;

  const paymentOptions = await resolvePaymentOptions(dataProvider, deal);

  return {
    kind: "found",
    contactName:
      `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim(),
    offerName: deal.offer_name_snapshot ?? "",
    cohortName: cohort?.name ?? null,
    frozenPrice: deal.offer_price_snapshot,
    isScholarship: deal.pricing_mode === "scholarship",
    paymentOptions,
    alreadyWon: deal.stage === "won",
  };
};

const resolvePaymentOptions = async (
  dataProvider: DataProvider,
  deal: Deal,
): Promise<OfferPagePaymentOption[]> => {
  // Leif already authorized exactly one option for this Deal (public or
  // not) — the frozen snapshot IS the option, no further choice offered.
  if (deal.selected_payment_option_id != null) {
    return deal.selected_payment_total != null &&
      deal.selected_installment_count != null &&
      deal.selected_installment_amount != null
      ? [
          {
            id: deal.selected_payment_option_id,
            name: await resolveOptionName(
              dataProvider,
              deal.selected_payment_option_id,
            ),
            total: deal.selected_payment_total,
            installments: deal.selected_installment_count,
            installmentAmount: deal.selected_installment_amount,
          },
        ]
      : [];
  }

  const { data: options } = await dataProvider.getList<OfferPaymentOption>(
    "offer_payment_options",
    {
      filter: {
        offer_id: deal.offer_id,
        is_public: true,
        pricing_mode: deal.pricing_mode ?? "standard",
      },
      pagination: { page: 1, perPage: 20 },
      sort: { field: "id", order: "ASC" },
    },
  );
  return options.map((option) => ({
    id: option.id,
    name: option.name,
    total: option.total,
    installments: option.installments,
    installmentAmount: option.installment_amount,
  }));
};

const resolveOptionName = async (
  dataProvider: DataProvider,
  optionId: Identifier,
): Promise<string> =>
  dataProvider
    .getOne<OfferPaymentOption>("offer_payment_options", { id: optionId })
    .then(({ data }) => data.name)
    .catch(() => "");
