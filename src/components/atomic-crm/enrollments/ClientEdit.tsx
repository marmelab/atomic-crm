import { EditBase, Form, required } from "ra-core";

import type { Enrollment } from "../types";
import { Card, CardContent } from "@/components/ui/card";
import { DateInput } from "@/components/admin/date-input";
import { SelectInput } from "@/components/admin/select-input";

import { FormToolbar } from "../layout/FormToolbar";
import { enrollmentStatuses } from "./enrollmentConstants";

// Dates are editable directly — GYU enrollments start out derived from
// their Cohort's program dates, and nothing here recomputes them if the
// owner adjusts them.
//
// This form is the pathway for setting a Start Week, so saving it IS the
// owner statement: whatever date Leif leaves in the field is, by the act
// of saving, a date he has stated. That is what promotes a
// session-derived guess to a canonical commitment the capacity ledger can
// plan around, and it is why the field had to stop being a bare
// "Start date" that the CRM might also fill in by itself.
const ownerStatesTheStartWeek = (data: Partial<Enrollment>) => ({
  ...data,
  start_date_source: data.start_date ? ("owner" as const) : null,
});

export const ClientEdit = () => (
  <EditBase actions={false} redirect="show" transform={ownerStatesTheStartWeek}>
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
                label="resources.enrollments.fields.start_week"
                helperText="resources.enrollments.fields.start_week_help"
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
