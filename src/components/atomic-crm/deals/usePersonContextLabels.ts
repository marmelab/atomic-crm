import { useGetList, type Identifier } from "ra-core";
import { useMemo } from "react";

import type { Deal, Enrollment, Offer } from "../types";
import { derivePersonContextLabel } from "./personContext";

// Loads the (small, fixture-scale) deals/offers/enrollments once and
// returns a lookup function, so every row rendered by the Person field's
// AutocompleteInput shares one cached fetch instead of one each.
export const usePersonContextLabels = () => {
  const { data: deals } = useGetList<Deal>("deals", {
    pagination: { page: 1, perPage: 1000 },
    sort: { field: "id", order: "ASC" },
  });
  const { data: offers } = useGetList<Offer>("offers", {
    pagination: { page: 1, perPage: 100 },
  });
  const { data: enrollments } = useGetList<Enrollment>("enrollments", {
    pagination: { page: 1, perPage: 1000 },
  });

  return useMemo(() => {
    const offersById = new Map(
      (offers ?? []).map((offer) => [String(offer.id), offer]),
    );
    const enrollmentsByOpportunity = new Map(
      (enrollments ?? []).map((enrollment) => [
        String(enrollment.opportunity_id),
        enrollment,
      ]),
    );
    return (contactId: Identifier) =>
      derivePersonContextLabel({
        contactId,
        deals: deals ?? [],
        offersById,
        enrollmentsByOpportunity,
      });
  }, [deals, offers, enrollments]);
};
