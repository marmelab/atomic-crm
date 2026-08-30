import { useRecordContext, useTranslate } from "ra-core";
import { DateField } from "@/components/admin/date-field";
import { EditButton } from "@/components/admin/edit-button";
import { ReferenceField } from "@/components/admin/reference-field";
import { RecordField } from "@/components/admin/record-field";
import { Show } from "@/components/admin/show";
import { Badge } from "@/components/ui/badge";

import type { Cohort } from "../types";
import { CohortPeopleSection } from "./CohortPeopleSection";
import { CohortCapacityBadge } from "./CohortCapacityBadge";
import { cohortStatusLabels } from "./cohortConstants";

export const CohortShow = () => (
  <Show actions={<EditButton />}>
    <div className="flex flex-col gap-4">
      <RecordField source="name" />
      <RecordField label="resources.cohorts.fields.offer_id">
        <ReferenceField source="offer_id" reference="offers" link={false} />
      </RecordField>
      <RecordField label="resources.cohorts.fields.status">
        <StatusBadge />
      </RecordField>
      <div className="flex flex-wrap gap-8">
        <RecordField label="resources.cohorts.fields.applications_open_at">
          <DateField source="applications_open_at" />
        </RecordField>
        <RecordField label="resources.cohorts.fields.applications_close_at">
          <DateField source="applications_close_at" />
        </RecordField>
        <RecordField label="resources.cohorts.fields.program_start_at">
          <DateField source="program_start_at" />
        </RecordField>
        <RecordField label="resources.cohorts.fields.program_end_at">
          <DateField source="program_end_at" />
        </RecordField>
      </div>
      <CapacitySummary />
      <CohortPeopleSection />
    </div>
  </Show>
);

const StatusBadge = () => {
  const record = useRecordContext<Cohort>();
  if (!record) return null;
  return <Badge variant="outline">{cohortStatusLabels[record.status]}</Badge>;
};

const CapacitySummary = () => {
  const record = useRecordContext<Cohort>();
  const translate = useTranslate();
  if (!record) return null;

  return (
    <div className="flex flex-col gap-1">
      <CohortCapacityBadge />
      <p className="text-xs text-muted-foreground">
        {translate("resources.cohorts.capacity_summary", {
          minimum: record.minimum_capacity ?? "—",
          target: record.target_capacity ?? "—",
        })}
      </p>
    </div>
  );
};
