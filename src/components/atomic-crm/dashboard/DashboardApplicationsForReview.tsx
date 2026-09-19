import { Link } from "react-router";
import { useGetList, useGetMany, useTranslate } from "ra-core";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Application, Contact, Deal, Offer } from "../types";
import { isActiveOpportunity } from "../deals/dealActivity";
import {
  describeReviewTiming,
  reviewTiming,
  type ReviewTiming,
} from "../applications/applicationReviewSla";
import { CollapsibleQueue } from "./CollapsibleQueue";

// Reviewing an application is normal work, not an emergency.
//
// Every new applicant used to land in Needs Attention — next to a booking
// nobody can attribute and a call whose outcome is unknown — with a Task
// whose due date was the moment they submitted, so it read as overdue
// immediately. That made routine work look like a failure and made real
// failures harder to see.
//
// This is the queue for the routine part. A Task is created only if one of
// these is still sitting here on day four, and even then the row stays
// here too: the work has not gone away just because it is also late.
export const DashboardApplicationsForReview = () => {
  const translate = useTranslate();

  // Pending submissions, then narrowed to the ones that are genuinely
  // current work. Ninety-nine Applications in this database are pending;
  // nearly all are recovered history whose sales attempt ended long ago,
  // and pending on a dead attempt is stale information, not a job.
  const { data: applications, isPending } = useGetList<Application>(
    "applications",
    {
      filter: { status: "pending" },
      pagination: { page: 1, perPage: 200 },
      // Oldest first: the ones closest to (or furthest past) the promise.
      sort: { field: "submitted_at", order: "ASC" },
    },
  );

  const opportunityIds = [
    ...new Set(
      (applications ?? [])
        .map((a) => a.opportunity_id)
        .filter((id): id is NonNullable<typeof id> => id != null),
    ),
  ];
  const { data: deals } = useGetMany<Deal>(
    "deals",
    { ids: opportunityIds },
    { enabled: opportunityIds.length > 0 },
  );

  const dealById = new Map((deals ?? []).map((d) => [String(d.id), d]));
  const awaiting = (applications ?? []).filter((application) => {
    if (application.opportunity_id == null) return false;
    const deal = dealById.get(String(application.opportunity_id));
    if (!deal) return false;
    // A live attempt, still at the stage where a decision is owed.
    return isActiveOpportunity(deal) && deal.stage === "application_received";
  });

  const contactIds = [...new Set(awaiting.map((a) => a.contact_id))];
  const { data: contacts } = useGetMany<Contact>(
    "contacts",
    { ids: contactIds },
    { enabled: contactIds.length > 0 },
  );
  const offerIds = [
    ...new Set(
      awaiting
        .map((a) => a.offer_id)
        .filter((id): id is NonNullable<typeof id> => id != null),
    ),
  ];
  const { data: offers } = useGetMany<Offer>(
    "offers",
    { ids: offerIds },
    { enabled: offerIds.length > 0 },
  );

  if (isPending || awaiting.length === 0) return null;

  const contactById = new Map((contacts ?? []).map((c) => [String(c.id), c]));
  const offerById = new Map((offers ?? []).map((o) => [String(o.id), o]));

  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-xl font-semibold">
        {translate("crm.dashboard.applications_for_review", {
          _: "Applications for Review",
        })}
      </h2>
      <Card>
        <CardContent className="flex flex-col gap-1 p-3">
          <CollapsibleQueue itemCount={awaiting.length}>
            {awaiting.map((application) => {
              const contact = contactById.get(String(application.contact_id));
              const offer = application.offer_id
                ? offerById.get(String(application.offer_id))
                : undefined;
              return (
                <ApplicationReviewRow
                  key={application.id}
                  applicationId={application.id}
                  name={
                    contact
                      ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim()
                      : translate("crm.dashboard.an_applicant", {
                          _: "An applicant",
                        })
                  }
                  offerName={offer?.name}
                  timing={reviewTiming(application.submitted_at)}
                />
              );
            })}
          </CollapsibleQueue>
        </CardContent>
      </Card>
    </div>
  );
};

const ApplicationReviewRow = ({
  applicationId,
  name,
  offerName,
  timing,
}: {
  applicationId: Application["id"];
  name: string;
  offerName?: string;
  timing: ReviewTiming;
}) => {
  const translate = useTranslate();
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="flex flex-col min-w-0">
        <span className="text-sm truncate">{name}</span>
        <span className="text-xs text-muted-foreground truncate">
          {[offerName, describeReviewTiming(timing)]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>
      {/* Straight to the application itself. Never the Task editor: the
          Task is a projection, the Application is the thing being acted
          on. */}
      <Button asChild size="sm" variant="outline">
        <Link to={`/applications/${applicationId}/show`}>
          {translate("crm.dashboard.review_application_action", {
            _: "Review",
          })}
        </Link>
      </Button>
    </div>
  );
};
