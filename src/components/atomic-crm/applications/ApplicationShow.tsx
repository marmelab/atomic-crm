import { ShowBase, useRecordContext, useTranslate } from "ra-core";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import type { Application } from "../types";
import { findDealLabel, formatTimestampString } from "../deals/dealUtils";
import { PageHeader, PersonCard, Section } from "../misc/ProgramLayout";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { ApplicationAnswers } from "./ApplicationAnswers";
import {
  applicationStatusBadgeVariant,
  applicationStatusLabels,
} from "./applicationConstants";
import { ApplicationReviewActions } from "./ApplicationReviewActions";
import { useApplicationReviewData } from "./useApplicationReviewData";

// The review command center (Native Applications slice, §2/§3): titled by
// the applicant, not "Application #4", using the same visual language as
// Living Example / GYU Cohort / Programs (PageHeader/Section/PersonCard —
// no new styling system).
export const ApplicationShow = () => (
  <ShowBase>
    <ApplicationShowContent />
  </ShowBase>
);

const ApplicationShowContent = () => {
  const record = useRecordContext<Application>();
  const translate = useTranslate();
  const { dealStages } = useConfigurationContext();
  const { isPending, deal, contact, offer, cohort } =
    useApplicationReviewData(record);

  if (!record || isPending || !deal || !contact || !offer) return null;

  const applicantName = `${contact.first_name} ${contact.last_name}`;
  const submittedLabel = translate(
    "resources.applications.fields.submitted_at",
    { _: "Submitted" },
  );
  const contextLine = [
    offer.name,
    cohort?.name,
    `${submittedLabel} ${formatTimestampString(record.submitted_at)}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const stageLabel = findDealLabel(dealStages, deal.stage) ?? deal.stage;

  return (
    <div className="flex flex-col gap-8 mt-1 p-1 max-w-3xl">
      <PageHeader
        title={applicantName}
        summary={
          <span className="flex flex-wrap items-center gap-2">
            <span>{contextLine}</span>
            <Badge variant={applicationStatusBadgeVariant[record.status]}>
              {applicationStatusLabels[record.status]}
            </Badge>
          </span>
        }
      />

      {/*
        The Application is the page's primary object (Native Applications
        repair pass, §1): Summary/Answers/Review Decision all live inside
        one large rounded container, the same Card primitive every other
        "big rounded box" on this page's siblings (PersonCard, Cohort
        Details) already uses — so the Application itself is unmistakably
        what this page is about, and Related Sales below reads as
        supporting context, not a competing object.
      */}
      <Card>
        <CardContent className="flex flex-col gap-6">
          <Section
            title={translate("resources.applications.review.summary_title", {
              _: "Application Summary",
            })}
          >
            {record.summary ? (
              <p className="text-sm">{record.summary}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {translate("resources.applications.review.summary_empty", {
                  _: "No summary yet.",
                })}
              </p>
            )}
          </Section>

          <Section
            title={translate("resources.applications.review.answers_title", {
              _: "Application Answers",
            })}
          >
            <ApplicationAnswers answers={record.raw_answers} />
          </Section>

          <Section
            title={translate("resources.applications.review.decision_title", {
              _: "Review Decision",
            })}
          >
            <ApplicationReviewActions
              application={record}
              deal={deal}
              applicantName={applicantName}
            />
          </Section>
        </CardContent>
      </Card>

      <Section
        title={translate("resources.applications.review.related_sales_title", {
          _: "Related Sales",
        })}
      >
        <PersonCard
          contactId={contact.id}
          to={`/deals/${deal.id}/show`}
          name={stageLabel}
          meta={[offer.name, cohort?.name].filter(Boolean).join(" · ")}
        />
      </Section>
    </div>
  );
};
