import { useRecordContext, useTranslate } from "ra-core";
import { DataTable } from "@/components/admin/data-table";
import { DateField } from "@/components/admin/date-field";
import { List } from "@/components/admin/list";
import { ReferenceField } from "@/components/admin/reference-field";
import { Badge } from "@/components/ui/badge";

import type { Application } from "../types";
import { applicationStatusLabels } from "./applicationConstants";

export const ApplicationList = () => {
  const translate = useTranslate();
  return (
    <List
      title={false}
      sort={{ field: "submitted_at", order: "DESC" }}
      pagination={false}
    >
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">
          {translate("resources.applications.name", { smart_count: 2 })}
        </h1>
        <p className="text-sm text-muted-foreground">
          {translate("resources.applications.orientation")}
        </p>
      </div>
      <DataTable rowClick="show">
        <DataTable.Col label="resources.applications.fields.contact">
          <ReferenceField
            source="opportunity_id"
            reference="deals"
            link={false}
          >
            <ReferenceField
              source="contact_id"
              reference="contacts"
              link="show"
            />
          </ReferenceField>
        </DataTable.Col>
        <DataTable.Col label="resources.applications.fields.offer">
          <ReferenceField
            source="opportunity_id"
            reference="deals"
            link={false}
          >
            <ReferenceField source="offer_id" reference="offers" link={false} />
          </ReferenceField>
        </DataTable.Col>
        <DataTable.Col label="resources.applications.fields.cohort">
          <ReferenceField
            source="opportunity_id"
            reference="deals"
            link={false}
          >
            <ReferenceField
              source="cohort_id"
              reference="cohorts"
              link={false}
              empty=""
            />
          </ReferenceField>
        </DataTable.Col>
        <DataTable.Col label="resources.applications.fields.submitted_at">
          <DateField source="submitted_at" />
        </DataTable.Col>
        <DataTable.Col label="resources.applications.fields.status">
          <StatusBadge />
        </DataTable.Col>
      </DataTable>
    </List>
  );
};

const StatusBadge = () => {
  const record = useRecordContext<Application>();
  if (!record) return null;
  return (
    <Badge variant={record.status === "pending" ? "outline" : "secondary"}>
      {applicationStatusLabels[record.status]}
    </Badge>
  );
};
