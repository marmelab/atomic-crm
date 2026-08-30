import { useRecordContext, useTranslate } from "ra-core";

import type { Cohort } from "../types";
import { useCohortCapacity } from "./useCohortCapacity";

export const CohortCapacityBadge = () => {
  const record = useRecordContext<Cohort>();
  const translate = useTranslate();
  const { enrolledCount, isPending } = useCohortCapacity(record?.id);

  if (!record) return null;
  if (isPending) return null;

  return (
    <span className="text-sm">
      {translate("resources.cohorts.enrolled_count", {
        enrolled: enrolledCount,
        maximum: record.maximum_capacity ?? "—",
      })}
    </span>
  );
};
