import { useParams } from "react-router";
import { useTranslate } from "ra-core";

import { CohortCapacityCard } from "../dashboard/CohortCapacityCard";
import { PageHeader, Section } from "../misc/ProgramLayout";
import { AddToWaitlistButton } from "../waitlist/AddToWaitlistButton";
import { WaitlistSection } from "../waitlist/WaitlistSection";
import { useWaitlistEntries } from "../waitlist/useWaitlistEntries";
import { useGroupProgramData } from "./useGroupProgramData";

// The "program-level" home for a group Offer (Waitlists slice, §8) —
// Growing Yourself Up's counterpart to the Living Example's individual
// program page. Didn't exist before this slice (the Programs hub's
// "Growing Yourself Up" heading wasn't even a link); closes that gap while
// giving the Offer's *general* waitlist ("wants GYU generally", no cohort
// preference) an obvious home distinct from any one Cohort's own
// cohort-specific waitlist (see cohorts/CohortShow.tsx).
export const GroupProgramPage = () => {
  const { offerId } = useParams();
  const translate = useTranslate();
  const { isPending, offer, cohorts } = useGroupProgramData(offerId);
  const { isPending: waitlistPending, entries: generalWaitlist } =
    useWaitlistEntries({ offerId, cohortId: null });

  if (isPending || waitlistPending) return null;
  if (!offer) {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground">
          {translate("crm.programs.group_not_found", {
            _: "This program could not be found.",
          })}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 mt-1 p-1 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <PageHeader title={offer.name} summary={offer.duration} />
        <AddToWaitlistButton offerId={offer.id} cohortId={null} />
      </div>

      <WaitlistSection entries={generalWaitlist} />

      <Section
        title={translate("crm.programs.cohorts_section", { _: "Cohorts" })}
      >
        {cohorts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {translate("crm.programs.no_active_cohorts", {
              _: "No active cohorts.",
            })}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            {cohorts.map((cohort) => (
              <CohortCapacityCard cohort={cohort} key={cohort.id} />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
};

GroupProgramPage.path = "/programs/group/:offerId";
