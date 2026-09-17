import { useTranslate } from "ra-core";
import { Badge } from "@/components/ui/badge";

import { PersonCard, Section } from "../misc/ProgramLayout";
import { humanizeCohortName } from "../cohorts/humanizeCohortName";
import {
  applicationStatusBadgeVariant,
  applicationStatusLabels,
} from "./applicationConstants";
import type {
  HistoricalApplicationGroup,
  HistoricalApplicationRow,
} from "./useHistoricalApplications";

// Imported Applications, grouped by what each applicant applied FOR.
// Enough to identify the person, when they applied and what was decided —
// deliberately not the review affordances, because there is nothing here
// to review.
export const HistoricalApplicationSections = ({
  groups,
}: {
  groups: HistoricalApplicationGroup[];
}) => (
  <div className="flex flex-col gap-6">
    {groups.map((group) => (
      <Section
        key={group.key}
        title={`${
          group.cohort && group.offer
            ? humanizeCohortName(group.cohort.name, group.offer.name)
            : group.label
        } · ${group.applications.length}`}
      >
        <div className="flex flex-col gap-2">
          {group.applications.map((row) => (
            <HistoricalApplicationRowCard key={row.applicationId} row={row} />
          ))}
        </div>
      </Section>
    ))}
  </div>
);

const HistoricalApplicationRowCard = ({
  row,
}: {
  row: HistoricalApplicationRow;
}) => {
  const translate = useTranslate();
  return (
    <PersonCard
      contactId={row.contactId}
      // The Contact, not the Application: there is no review page to go to,
      // and the person is what this record is about.
      to={`/contacts/${row.contactId}/show`}
      name={row.contactName}
      meta={
        <>
          {row.submittedAt
            ? translate("resources.applications.submitted_on", {
                _: "applied %{date}",
                date: new Date(row.submittedAt).toLocaleDateString(),
              })
            : translate("resources.applications.submitted_unknown", {
                _: "application date not recorded",
              })}
          {/* Common and legitimate for imported records: they applied, but
              no Opportunity was ever created for them. */}
          {!row.hasOpportunity &&
            ` · ${translate("resources.applications.no_opportunity", {
              _: "no Opportunity",
            })}`}
        </>
      }
      trailing={
        <Badge variant={applicationStatusBadgeVariant[row.status]}>
          {applicationStatusLabels[row.status]}
        </Badge>
      }
    />
  );
};
