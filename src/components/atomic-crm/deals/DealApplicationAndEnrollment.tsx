import { Link } from "react-router";
import { useGetList, useRecordContext, useTranslate } from "ra-core";

import { applicationStatusLabels } from "../applications/applicationConstants";
import { enrollmentStatusLabels } from "../enrollments/enrollmentConstants";
import type { Application, Deal, Enrollment } from "../types";
import { formatISODateString } from "./dealUtils";

// Surfaces this Opportunity's Application (if any) and Enrollment (if any)
// inline, so the Contact -> Opportunity -> Application/Enrollment history is
// navigable without a separate cross-resource list on the Contact page.
export const DealApplicationAndEnrollment = () => {
  const record = useRecordContext<Deal>();
  const translate = useTranslate();

  const { data: applications } = useGetList<Application>(
    "applications",
    {
      filter: { opportunity_id: record?.id },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "submitted_at", order: "DESC" },
    },
    { enabled: !!record },
  );
  const { data: enrollments } = useGetList<Enrollment>(
    "enrollments",
    {
      filter: { opportunity_id: record?.id },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "DESC" },
    },
    { enabled: !!record },
  );

  const application = applications?.[0];
  const enrollment = enrollments?.[0];

  if (!application && !enrollment) return null;

  return (
    <div className="flex flex-wrap gap-8 m-4">
      {application && (
        <div className="flex flex-col mr-10">
          <span className="text-xs text-muted-foreground tracking-wide">
            {translate("resources.applications.name", { smart_count: 1 })}
          </span>
          <span className="text-sm">
            <Link
              to={`/applications/${application.id}/show`}
              className="underline hover:no-underline"
            >
              {applicationStatusLabels[application.status]}
            </Link>
          </span>
        </div>
      )}
      {enrollment && (
        <div className="flex flex-col mr-10">
          <span className="text-xs text-muted-foreground tracking-wide">
            {translate("resources.enrollments.name", { smart_count: 1 })}
          </span>
          <span className="text-sm">
            <Link
              to={`/enrollments/${enrollment.id}/show`}
              className="underline hover:no-underline"
            >
              {enrollmentStatusLabels[enrollment.status]}
            </Link>
            {enrollment.start_date && (
              <>
                {" "}
                ({formatISODateString(enrollment.start_date)}
                {enrollment.end_date
                  ? ` – ${formatISODateString(enrollment.end_date)}`
                  : ""}
                )
              </>
            )}
          </span>
        </div>
      )}
    </div>
  );
};
