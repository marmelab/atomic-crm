import { useRecordContext, useTranslate } from "ra-core";
import { DataTable } from "@/components/admin/data-table";
import { DateField } from "@/components/admin/date-field";
import { List } from "@/components/admin/list";
import { ReferenceField } from "@/components/admin/reference-field";
import { Badge } from "@/components/ui/badge";

import type { Enrollment } from "../types";
import { enrollmentStatusLabels } from "./enrollmentConstants";

// "Clients" is a lifecycle view over the same Contacts, seen through their
// Enrollment — people who completed the sales process and enrolled. No
// separate Person table: the underlying resource is still `enrollments`.
export const ClientList = () => {
  const translate = useTranslate();
  return (
    <List
      title={false}
      sort={{ field: "start_date", order: "DESC" }}
      pagination={false}
    >
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">
          {translate("resources.enrollments.name", { smart_count: 2 })}
        </h1>
        <p className="text-sm text-muted-foreground">
          {translate("resources.enrollments.orientation")}
        </p>
      </div>
      <DataTable rowClick="show">
        <DataTable.Col label="resources.enrollments.fields.contact">
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
        <DataTable.Col label="resources.enrollments.fields.offer">
          <ReferenceField
            source="opportunity_id"
            reference="deals"
            link={false}
          >
            <ReferenceField source="offer_id" reference="offers" link={false} />
          </ReferenceField>
        </DataTable.Col>
        <DataTable.Col label="resources.enrollments.fields.cohort">
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
        <DataTable.Col label="resources.enrollments.fields.status">
          <StatusBadge />
        </DataTable.Col>
        <DataTable.Col label="resources.enrollments.fields.start_date">
          <DateField source="start_date" />
        </DataTable.Col>
        <DataTable.Col label="resources.enrollments.fields.end_date">
          <DateField source="end_date" />
        </DataTable.Col>
      </DataTable>
    </List>
  );
};

const StatusBadge = () => {
  const record = useRecordContext<Enrollment>();
  if (!record) return null;
  return (
    <Badge variant={record.status === "completed" ? "secondary" : "outline"}>
      {enrollmentStatusLabels[record.status]}
    </Badge>
  );
};
