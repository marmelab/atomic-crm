import { useTranslate } from "ra-core";
import { Badge } from "@/components/ui/badge";
import { DateField } from "@/components/admin/date-field";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import { PageHeader, PersonCard, Section } from "../misc/ProgramLayout";
import { humanizeCohortName } from "../cohorts/humanizeCohortName";
import {
  applicationStatusBadgeVariant,
  applicationStatusLabels,
} from "./applicationConstants";
import {
  useApplicationsGrouped,
  type ApplicationGroups,
  type ApplicationRow,
} from "./useApplicationsGrouped";

// Applications is a single, unified Application table underneath — the
// grouping below is purely presentational, derived from each Application's
// real Offer/Cohort relationship (Runtime + Visual Consistency slice, §5):
// one section per individual (1:1) Offer, and one section per Cohort under
// its group Offer. No new Application resource, no hand-maintained list.
//
// UX cleanup pass, §3: "what needs my attention" is now the PRIMARY
// question this page answers. Needs Review (status 'pending') is always
// expanded; every already-reviewed outcome (Approved/Not Fit/Needs Higher
// Care/Do Not Engage — applicationConstants.ts's own vocabulary, nothing
// new) is demoted into a collapsed "Reviewed Applications" history section
// so real application volume doesn't bury what's actually actionable.
// Review behavior/outcome semantics are completely untouched — this only
// changes which section a row renders in, driven by the same `status`
// field reviewApplication.ts already writes.
export const ApplicationList = () => {
  const translate = useTranslate();
  const { isPending, needsReview, reviewed } = useApplicationsGrouped();

  if (isPending) return null;

  const needsReviewCount = countApplications(needsReview);
  const reviewedCount = countApplications(reviewed);
  const isEmpty = needsReviewCount === 0 && reviewedCount === 0;

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

      {needsReviewCount > 0 && (
        <div className="flex flex-col gap-6">
          <h2 className="text-lg font-semibold">
            {translate("resources.applications.needs_review", {
              _: "Needs Review",
            })}
          </h2>
          <ApplicationGroupSections groups={needsReview} />
        </div>
      )}

      {needsReviewCount === 0 && reviewedCount > 0 && (
        <p className="text-sm text-muted-foreground">
          {translate("resources.applications.needs_review_empty", {
            _: "Nothing waiting for review.",
          })}
        </p>
      )}

      {reviewedCount > 0 && (
        <Accordion type="single" collapsible>
          <AccordionItem value="reviewed" className="border-none">
            <AccordionTrigger className="text-lg font-semibold hover:no-underline py-0">
              {translate("resources.applications.reviewed", {
                _: "Reviewed Applications",
                count: reviewedCount,
              })}
              <span className="text-sm font-normal text-muted-foreground ml-auto mr-2">
                {reviewedCount}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-col gap-6 pt-2">
                <ApplicationGroupSections groups={reviewed} />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
};

const countApplications = (groups: ApplicationGroups): number =>
  groups.individualGroups.reduce((sum, g) => sum + g.applications.length, 0) +
  groups.groupOfferGroups.reduce(
    (sum, g) => sum + g.cohorts.reduce((s, c) => s + c.applications.length, 0),
    0,
  );

const ApplicationGroupSections = ({
  groups,
}: {
  groups: ApplicationGroups;
}) => (
  <>
    {groups.individualGroups.map((group) => (
      // "1:1 — " prefix dropped (UX cleanup pass, §3): the owner already
      // knows The Living Example is a 1:1 program.
      <Section key={`offer-${group.offer.id}`} title={group.offer.name}>
        <ApplicationRows rows={group.applications} />
      </Section>
    ))}

    {groups.groupOfferGroups.map((group) => (
      // Applications hierarchy repair: the Offer (parent Program, e.g.
      // "Growing Yourself Up") is now the visually primary heading and
      // each Cohort (the particular run, e.g. "September Cohort") is
      // secondary/smaller — previously reversed, since Section's own
      // title was always the larger of the two regardless of which
      // concept it labeled. Grouping/domain behavior and the persisted
      // Offer/Cohort names are untouched — display hierarchy only.
      <div key={`offer-${group.offer.id}`} className="flex flex-col gap-4">
        <h3 className="text-xl font-semibold">{group.offer.name}</h3>
        {group.cohorts.map((cohortGroup) => (
          <Section
            key={`cohort-${cohortGroup.cohort.id}`}
            emphasis="secondary"
            // Redundant Offer initials dropped from the Cohort name (e.g.
            // "September GYU Cohort" -> "September Cohort") — a pure
            // presentation helper, the persisted Cohort name is untouched
            // (see humanizeCohortName.ts's own header).
            title={humanizeCohortName(
              cohortGroup.cohort.name,
              group.offer.name,
            )}
          >
            <ApplicationRows rows={cohortGroup.applications} />
          </Section>
        ))}
      </div>
    ))}
  </>
);

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
