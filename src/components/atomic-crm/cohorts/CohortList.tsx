import { useRecordContext, useTranslate } from "ra-core";
import { CreateButton } from "@/components/admin/create-button";
import { DataTable } from "@/components/admin/data-table";
import { DateField } from "@/components/admin/date-field";
import { List } from "@/components/admin/list";
import { ReferenceField } from "@/components/admin/reference-field";
import { Badge } from "@/components/ui/badge";

import { TopToolbar } from "../layout/TopToolbar";
import type { Cohort } from "../types";
import { CohortCapacityBadge } from "./CohortCapacityBadge";
import { cohortStatusLabels } from "./cohortConstants";

const CohortListActions = () => (
  <TopToolbar>
    <CreateButton label="resources.cohorts.action.new" />
  </TopToolbar>
);

export const CohortList = () => {
  const translate = useTranslate();
  return (
    <List
      title={false}
      sort={{ field: "program_start_at", order: "ASC" }}
      pagination={false}
      actions={<CohortListActions />}
    >
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">
          {translate("resources.cohorts.name", { smart_count: 2 })}
        </h1>
        <p className="text-sm text-muted-foreground">
          {translate("resources.cohorts.orientation")}
        </p>
      </div>
      <DataTable rowClick="show">
        <DataTable.Col source="name" />
        <DataTable.Col label="resources.cohorts.fields.offer_id">
          <ReferenceField source="offer_id" reference="offers" link={false} />
        </DataTable.Col>
        <DataTable.Col label="resources.cohorts.fields.program_start_at">
          <DateField source="program_start_at" />
        </DataTable.Col>
        <DataTable.Col label="resources.cohorts.fields.program_end_at">
          <DateField source="program_end_at" />
        </DataTable.Col>
        <DataTable.Col label="resources.cohorts.fields.status">
          <StatusBadge />
        </DataTable.Col>
        <DataTable.Col label="resources.cohorts.enrolled_count_label">
          <CohortCapacityBadge />
        </DataTable.Col>
        <DataTable.Col source="minimum_capacity" />
        <DataTable.Col source="target_capacity" />
      </DataTable>
    </List>
  );
};

const StatusBadge = () => {
  const record = useRecordContext<Cohort>();
  if (!record) return null;
  return <Badge variant="outline">{cohortStatusLabels[record.status]}</Badge>;
};
