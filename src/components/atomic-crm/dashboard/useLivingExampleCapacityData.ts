import { useGetList } from "ra-core";

import type { Deal, Enrollment, Offer } from "../types";
import { computeLivingExampleCapacity } from "./livingExampleCapacity";

// Finds "the" individual Offer with a capacity ceiling — Living Example
// today, and whichever individual offer plays that role later — rather
// than hardcoding a name or id.
export const useLivingExampleCapacityData = () => {
  const { data: offers, isPending: offersPending } = useGetList<Offer>(
    "offers",
    {
      filter: { type: "individual" },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    },
  );
  const offer = offers?.find((o) => o.max_active_clients != null);

  const { data: deals, isPending: dealsPending } = useGetList<Deal>(
    "deals",
    {
      filter: { offer_id: offer?.id },
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "id", order: "ASC" },
    },
    { enabled: offer != null },
  );

  const dealIds = deals?.map((deal) => deal.id) ?? [];
  const { data: enrollments, isPending: enrollmentsPending } =
    useGetList<Enrollment>(
      "enrollments",
      {
        filter: { "opportunity_id@in": `(${dealIds.join(",")})` },
        pagination: { page: 1, perPage: 1000 },
        sort: { field: "id", order: "ASC" },
      },
      { enabled: !dealsPending && offer != null },
    );

  const isPending =
    offersPending || (offer != null && (dealsPending || enrollmentsPending));

  if (isPending || !offer) {
    return { isPending, offer: offer ?? null, capacity: null };
  }

  return {
    isPending: false,
    offer,
    capacity: computeLivingExampleCapacity(
      enrollments ?? [],
      offer.max_active_clients ?? null,
    ),
  };
};
