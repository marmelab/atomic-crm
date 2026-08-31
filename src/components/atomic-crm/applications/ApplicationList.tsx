import { useTranslate } from "ra-core";
import { Badge } from "@/components/ui/badge";
import { DateField } from "@/components/admin/date-field";

import { PageHeader, PersonCard, Section } from "../misc/ProgramLayout";
import {
  applicationStatusBadgeVariant,
  applicationStatusLabels,
} from "./applicationConstants";
import {
  useApplicationsGrouped,
  type ApplicationRow,
} from "./useApplicationsGrouped";

// Applications is a single, unified Application table underneath — the
// grouping below is purely presentational, derived from each Application's
// real Offer/Cohort relationship (Runtime + Visual Consistency slice, §5):
// one section per individual (1:1) Offer, and one section per Cohort under
// its group Offer. No new Application resource, no hand-maintained list.
export const ApplicationList = () => {
  const translate = useTranslate();
  const { isPending, individualGroups, groupOfferGroups } =
    useApplicationsGrouped();

  if (isPending) return null;

  const isEmpty =
    individualGroups.length === 0 && groupOfferGroups.length === 0;

  return (
    <div className="flex flex-col gap-8 mt-1 p-1 max-w-3xl">
      <PageHeader
        title={translate("resources.applications.name", { smart_count: 2 })}
        summary={translate("resources.applications.orientation")}
      />

      {isEmpty && (
        <p className="text-sm text-muted-foreground">
          {translate("resources.applications.empty", {
            _: "No applications yet.",
          })}
        </p>
      )}

      {individualGroups.map((group) => (
        <Section
          key={`offer-${group.offer.id}`}
          title={translate("resources.applications.individual_group_label", {
            _: `1:1 — ${group.offer.name}`,
            name: group.offer.name,
          })}
        >
          <ApplicationRows rows={group.applications} />
        </Section>
      ))}

      {groupOfferGroups.map((group) => (
        <div key={`offer-${group.offer.id}`} className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-muted-foreground">
            {group.offer.name}
          </h2>
          {group.cohorts.map((cohortGroup) => (
            <Section
              key={`cohort-${cohortGroup.cohort.id}`}
              title={cohortGroup.cohort.name}
            >
              <ApplicationRows rows={cohortGroup.applications} />
            </Section>
          ))}
        </div>
      ))}
    </div>
  );
};

const ApplicationRows = ({ rows }: { rows: ApplicationRow[] }) => {
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => {
        const submittedLabel = translate(
          "resources.applications.fields.submitted_at",
          { _: "Submitted" },
        );
        return (
          <PersonCard
            key={row.applicationId}
            contactId={row.contactId}
            to={`/applications/${row.applicationId}/show`}
            name={row.contactName}
            meta={
              <>
                {submittedLabel}{" "}
                {/* submitted_at is a full timestamp (timestamptz), not a
                    bare date — formatISODateString is for date-only columns
                    and throws on this shape, so reuse the same DateField
                    the previous flat table used for this exact column. */}
                <DateField
                  source="submitted_at"
                  record={{ submitted_at: row.submittedAt }}
                />
              </>
            }
            trailing={
              <Badge variant={applicationStatusBadgeVariant[row.status]}>
                {applicationStatusLabels[row.status]}
              </Badge>
            }
          />
        );
      })}
    </div>
  );
};
