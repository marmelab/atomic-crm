import { EditBase, Form, required } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";
import { DateInput } from "@/components/admin/date-input";
import { SelectInput } from "@/components/admin/select-input";

import { FormToolbar } from "../layout/FormToolbar";
import { enrollmentStatuses } from "./enrollmentConstants";

// Dates are editable directly for this slice — GYU enrollments start out
// derived from their Cohort's program dates, but nothing here recomputes
// them automatically if the owner adjusts them (see the domain-model proof
// slice report, "Enrollment dates").
export const ClientEdit = () => (
  <EditBase actions={false} redirect="show">
    <div className="mt-2 flex gap-8">
      <Form className="flex flex-1 flex-col gap-4 pb-2">
        <Card>
          <CardContent className="flex flex-col gap-4">
            <SelectInput
              source="status"
              choices={enrollmentStatuses}
              optionText="label"
              optionValue="value"
              helperText={false}
              validate={required()}
            />
            <div className="flex flex-col sm:flex-row gap-4">
              <DateInput
                source="start_date"
                label="resources.enrollments.fields.start_date"
                helperText={false}
              />
              <DateInput
                source="end_date"
                label="resources.enrollments.fields.end_date"
                helperText={false}
              />
            </div>
            <FormToolbar />
          </CardContent>
        </Card>
      </Form>
    </div>
  </EditBase>
);
