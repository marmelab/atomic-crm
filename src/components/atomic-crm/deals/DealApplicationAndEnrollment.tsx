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

  // Every Application linked to THIS sales attempt, oldest first.
  //
  // It used to ask for one row, newest first, and show that. A person who
  // submitted twice had their earlier submission silently dropped — not
  // marked as superseded, not collapsed, just absent, with nothing on
  // screen to say another existed. Multiple submissions against one
  // attempt are legitimate, so they are all shown and ordered the way they
  // happened.
  //
  // Cross-Offer contamination is no longer possible here: an Application
  // may only name an Opportunity with the same Contact and the same Offer
  // (enforce_application_opportunity_agreement), so this list can never
  // contain another programme's answers.
  const { data: applications } = useGetList<Application>(
    "applications",
    {
      filter: { opportunity_id: record?.id },
      pagination: { page: 1, perPage: 25 },
      sort: { field: "submitted_at", order: "ASC" },
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

  const linkedApplications = applications ?? [];
  const enrollment = enrollments?.[0];

  if (linkedApplications.length === 0 && !enrollment) return null;

  return (
    <div className="flex flex-wrap gap-8 m-4">
      {linkedApplications.length > 0 && (
        <div className="flex flex-col mr-10">
          <span className="text-xs text-muted-foreground tracking-wide">
            {translate("resources.applications.name", {
              smart_count: linkedApplications.length,
            })}
          </span>
          {linkedApplications.map((application) => (
            <span key={application.id} className="text-sm">
              <Link
                to={`/applications/${application.id}/show`}
                className="underline hover:no-underline"
              >
                {applicationStatusLabels[application.status]}
              </Link>
              {/* Two submissions read as one line each, and the date is
                  what tells them apart. */}
              {linkedApplications.length > 1 && application.submitted_at && (
                <span className="text-muted-foreground">
                  {" · "}
                  {formatISODateString(application.submitted_at)}
                </span>
              )}
            </span>
          ))}
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
