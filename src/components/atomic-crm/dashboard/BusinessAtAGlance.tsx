import { useGetList, useTranslate } from "ra-core";

import type { Cohort } from "../types";
import { CohortCapacityCard } from "./CohortCapacityCard";
import { LivingExampleCapacityCard } from "./LivingExampleCapacityCard";

// "How full is my 1:1 practice? How full are my group cohorts?" — real
// Offer/Cohort/Enrollment data only, no hard-coded dashboard numbers.
export const BusinessAtAGlance = () => {
  const translate = useTranslate();
  const { data: cohorts, isPending } = useGetList<Cohort>("cohorts", {
    filter: { "status@neq": "completed" },
    pagination: { page: 1, perPage: 20 },
    sort: { field: "program_start_at", order: "ASC" },
  });

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-xl font-semibold">
        {translate("crm.dashboard.business_at_a_glance_title", {
          _: "Business at a Glance",
        })}
      </h2>
      <p className="text-sm text-muted-foreground mb-1">
        {translate("crm.dashboard.business_at_a_glance_orientation", {
          _: "A quick look at client capacity and current programs.",
        })}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
        <LivingExampleCapacityCard />
        {!isPending &&
          cohorts?.map((cohort) => (
            <CohortCapacityCard cohort={cohort} key={cohort.id} />
          ))}
      </div>
    </div>
  );
};
