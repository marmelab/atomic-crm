import { DateField } from "@/components/admin/date-field";
import { EditButton } from "@/components/admin/edit-button";
import { ReferenceField } from "@/components/admin/reference-field";
import { RecordField } from "@/components/admin/record-field";
import { Show } from "@/components/admin/show";

import { Avatar } from "../contacts/Avatar";
import { enrollmentStatusLabels } from "./enrollmentConstants";
import type { Enrollment } from "../types";

export const ClientShow = () => (
  <Show actions={<EditButton />}>
    <div className="flex flex-col gap-4">
      <RecordField label="resources.enrollments.fields.contact">
        <ReferenceField source="opportunity_id" reference="deals" link={false}>
          <div className="flex items-center gap-2">
            <ReferenceField
              source="contact_id"
              reference="contacts"
              link="show"
            >
              <Avatar />
            </ReferenceField>
            <ReferenceField
              source="contact_id"
              reference="contacts"
              link="show"
            />
          </div>
        </ReferenceField>
      </RecordField>
      <RecordField label="resources.enrollments.fields.offer">
        <ReferenceField source="opportunity_id" reference="deals" link={false}>
          <ReferenceField source="offer_id" reference="offers" link="show" />
        </ReferenceField>
      </RecordField>
      <RecordField label="resources.enrollments.fields.cohort">
        <ReferenceField source="opportunity_id" reference="deals" link={false}>
          <ReferenceField
            source="cohort_id"
            reference="cohorts"
            link="show"
            empty=""
          />
        </ReferenceField>
      </RecordField>
      <RecordField label="resources.enrollments.fields.opportunity">
        <ReferenceField source="opportunity_id" reference="deals" link="show" />
      </RecordField>
      <RecordField
        label="resources.enrollments.fields.status"
        render={(record: Enrollment) => enrollmentStatusLabels[record.status]}
      />
      <RecordField label="resources.enrollments.fields.start_date">
        <DateField source="start_date" />
      </RecordField>
      <RecordField label="resources.enrollments.fields.end_date">
        <DateField source="end_date" />
      </RecordField>
    </div>
  </Show>
);
