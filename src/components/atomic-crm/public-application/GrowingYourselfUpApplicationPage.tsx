import { useEffect, useState } from "react";
import { useParams } from "react-router";

import type { PublicApplicationDataSource } from "./publicApplicationDataSource";
import type { PublicOfferContext } from "./publicOfferContext";
import { PublicApplicationLayout } from "./PublicApplicationLayout";
import {
  PublicApplicationForm,
  type ApplicationQuestion,
} from "./PublicApplicationForm";
import { NotFoundNotice } from "./NotFoundNotice";

const QUESTIONS: ApplicationQuestion[] = [
  {
    key: "why_this_cohort",
    label: "Why this cohort?",
    required: true,
    placeholder: "What made you want to apply for this cohort?",
  },
  {
    key: "availability",
    label: "Availability",
    required: false,
    placeholder: "Anything about your schedule we should know?",
  },
];

// /apply/growing-yourself-up/:cohortId — route-driven Cohort context
// (§2B): a new Cohort never needs a new hardcoded page, only a new row.
// The Cohort's own numeric id is the route param — it isn't sensitive
// (a sequential identifier for an offering, not personal data) and
// reusing it avoids inventing a separate public-slug schema field beyond
// what §1 calls "the smallest durable schema change needed" (none, here).
export const GrowingYourselfUpApplicationPage = ({
  dataSource,
}: {
  dataSource: PublicApplicationDataSource;
}) => {
  const { cohortId } = useParams();
  const [context, setContext] = useState<PublicOfferContext | "pending">(
    "pending",
  );

  useEffect(() => {
    if (!cohortId) {
      setContext({ kind: "not-found" });
      return;
    }
    let cancelled = false;
    dataSource.getGroupCohortContext(cohortId).then((result) => {
      if (!cancelled) setContext(result);
    });
    return () => {
      cancelled = true;
    };
  }, [dataSource, cohortId]);

  if (context === "pending") return null;

  if (context.kind === "not-found") {
    return (
      <PublicApplicationLayout
        title="Apply"
        orientation="This application isn't available right now."
      >
        <NotFoundNotice />
      </PublicApplicationLayout>
    );
  }

  if (context.kind === "group-closed") {
    return (
      <PublicApplicationLayout
        title={context.offerName}
        orientation={`Applications for this cohort are closed.`}
      >
        <NotFoundNotice message="Applications for this cohort aren't open right now. Please check back later, or reach out if you'd like to be considered for a future cohort." />
      </PublicApplicationLayout>
    );
  }

  if (context.kind !== "group-open") return null;

  return (
    <PublicApplicationLayout
      title={`${context.offerName} — ${context.cohortName}`}
      orientation="A few questions to get to know you and your fit for this cohort."
    >
      <PublicApplicationForm
        questions={QUESTIONS}
        onSubmit={async (values) => {
          const result = await dataSource.submitApplication({
            offerId: context.offerId,
            cohortId: context.cohortId,
            firstName: values.firstName,
            lastName: values.lastName,
            email: values.email,
            phone: values.phone || null,
            answers: values.answers,
          });
          if (result.status === "submitted") return { ok: true };
          if (result.status === "validation-error") {
            return { ok: false, formError: result.message };
          }
          if (result.status === "cohort-closed") {
            return {
              ok: false,
              formError: "Applications for this cohort just closed.",
            };
          }
          return {
            ok: false,
            formError: "This application isn't available right now.",
          };
        }}
      />
    </PublicApplicationLayout>
  );
};

GrowingYourselfUpApplicationPage.path = "/apply/growing-yourself-up/:cohortId";
