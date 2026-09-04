import { ShowBase, useRecordContext, useTranslate } from "ra-core";
import { EditButton } from "@/components/admin/edit-button";
import { ReferenceField } from "@/components/admin/reference-field";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import { PageHeader, PersonCard, Section } from "../misc/ProgramLayout";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { findDealLabel, formatISODateString } from "../deals/dealUtils";
import {
  applicationStatusBadgeVariant,
  applicationStatusLabels,
} from "../applications/applicationConstants";
import { enrollmentStatusLabels } from "../enrollments/enrollmentConstants";
import type { Cohort } from "../types";
import { CopyApplicationLinkButton } from "../public-application/CopyApplicationLinkButton";
import { GrowingYourselfUpApplicationPage } from "../public-application/GrowingYourselfUpApplicationPage";
import { AddToWaitlistButton } from "../waitlist/AddToWaitlistButton";
import { WaitlistSection } from "../waitlist/WaitlistSection";
import { useWaitlistEntries } from "../waitlist/useWaitlistEntries";
import { cohortStatusLabels } from "./cohortConstants";
import { describeCohortThreshold } from "../dashboard/cohortThreshold";
import { useCohortPageData } from "./useCohortPageData";

const thresholdLabels: Record<string, string | null> = {
  below_minimum: "Below minimum",
  minimum_reached: "Minimum reached",
  target_reached: "Target reached",
  full: "Full",
  unknown: null,
};

// A Cohort detail page — same visual language as the Living Example / 1:1
// Offer page (PageHeader/Section/PersonCard from misc/ProgramLayout.tsx),
// so moving between the two feels like one product (Runtime + Visual
// Consistency slice, §3). Real Deal/Enrollment/Application data grouped by
// meaning (Enrolled Clients / People Deciding / Applications / Cohort
// Details); nothing here is a new "Program" concept — Cohort remains the
// same domain object, just presented consistently.
export const CohortShow = () => (
  <ShowBase>
    <CohortShowContent />
  </ShowBase>
);

const CohortShowContent = () => {
  const record = useRecordContext<Cohort>();
  const translate = useTranslate();
  const { dealStages } = useConfigurationContext();
  const { isPending, enrolledClients, peopleDeciding, applications } =
    useCohortPageData(record?.id);
  const { isPending: waitlistPending, entries: waitlist } = useWaitlistEntries({
    offerId: record?.offer_id,
    cohortId: record?.id ?? null,
  });

  if (!record || isPending || waitlistPending) return null;

  const threshold = describeCohortThreshold({
    enrolled: enrolledClients.length,
    minimum: record.minimum_capacity,
    target: record.target_capacity,
    maximum: record.maximum_capacity,
  });
  const thresholdLabel = thresholdLabels[threshold];
  const seatsRemaining =
    record.maximum_capacity != null
      ? Math.max(record.maximum_capacity - enrolledClients.length, 0)
      : null;

  return (
    <div className="flex flex-col gap-8 mt-1 p-1 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          eyebrow={
            <ReferenceField
              source="offer_id"
              reference="offers"
              record={record}
              link={false}
            />
          }
          title={record.name}
          summary={
            <span className="flex flex-wrap items-center gap-2">
              <span>
                {enrolledClients.length}
                {record.maximum_capacity != null && (
                  <span> / {record.maximum_capacity}</span>
                )}{" "}
                {translate("crm.dashboard.capacity_enrolled", {
                  _: "enrolled",
                })}
                {seatsRemaining != null &&
                  ` · ${translate("crm.dashboard.seats_remaining", {
                    _: "%{count} seats left",
                    count: seatsRemaining,
                  })}`}
                {peopleDeciding.length > 0 &&
                  ` · ${translate("crm.dashboard.people_deciding_count", {
                    _: "%{smart_count} person deciding |||| %{smart_count} people deciding",
                    smart_count: peopleDeciding.length,
                  })}`}
                {waitlist.length > 0 &&
                  ` · ${translate("resources.waitlist_entries.count", {
                    _: "%{count} waiting",
                    count: waitlist.length,
                  })}`}
              </span>
              {thresholdLabel && (
                <Badge variant="outline">{thresholdLabel}</Badge>
              )}
            </span>
          }
        />
        <div className="flex items-center gap-2">
          <CopyApplicationLinkButton
            path={GrowingYourselfUpApplicationPage.path.replace(
              ":cohortId",
              String(record.id),
            )}
            label={record.name}
          />
          <AddToWaitlistButton offerId={record.offer_id} cohortId={record.id} />
          <EditButton />
        </div>
      </div>

      <Section
        title={translate("resources.cohorts.people.enrolled", {
          _: "Enrolled Clients",
        })}
      >
        {enrolledClients.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {translate("resources.cohorts.people.empty", {
              _: "Nobody yet.",
            })}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {enrolledClients.map((client) => (
              <PersonCard
                key={client.dealId}
                contactId={client.contactId}
                name={client.name}
                trailing={
                  <Badge variant="outline">
                    {enrollmentStatusLabels[client.status]}
                  </Badge>
                }
              />
            ))}
          </div>
        )}
      </Section>

      <Section
        title={translate("crm.dashboard.people_deciding_title", {
          _: "People Deciding",
        })}
      >
        {peopleDeciding.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {translate("resources.cohorts.people.empty", {
              _: "Nobody yet.",
            })}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {peopleDeciding.map((person) => (
              <PersonCard
                key={person.dealId}
                contactId={person.contactId}
                name={person.name}
                meta={findDealLabel(dealStages, person.stage)}
              />
            ))}
          </div>
        )}
      </Section>

      <Section
        title={translate("resources.applications.name", { smart_count: 2 })}
      >
        {applications.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {translate("resources.cohorts.people.empty", {
              _: "Nobody yet.",
            })}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {applications.map((application) => (
              <PersonCard
                key={application.applicationId}
                contactId={application.contactId}
                to={`/applications/${application.applicationId}/show`}
                name={application.name}
                meta={formatISODateString(
                  application.submittedAt.split("T")[0]!,
                )}
                trailing={
                  <Badge
                    variant={applicationStatusBadgeVariant[application.status]}
                  >
                    {applicationStatusLabels[application.status]}
                  </Badge>
                }
              />
            ))}
          </div>
        )}
      </Section>

      {/* Density pass, §1: Waitlist comes after Applications — Applications/
          People Deciding are active sales activity, Waitlist is passive/
          future intent. */}
      <WaitlistSection entries={waitlist} />

      <Section
        title={translate("crm.programs.cohort_details", {
          _: "Cohort Details",
        })}
      >
        <Card>
          <CardContent className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            <DetailField
              label={translate("resources.cohorts.fields.status")}
              value={cohortStatusLabels[record.status]}
            />
            <DetailField
              label={translate("resources.cohorts.fields.applications_open_at")}
              value={
                record.applications_open_at
                  ? formatISODateString(record.applications_open_at)
                  : "—"
              }
            />
            <DetailField
              label={translate(
                "resources.cohorts.fields.applications_close_at",
              )}
              value={
                record.applications_close_at
                  ? formatISODateString(record.applications_close_at)
                  : "—"
              }
            />
            <DetailField
              label={translate("resources.cohorts.fields.program_start_at")}
              value={
                record.program_start_at
                  ? formatISODateString(record.program_start_at)
                  : "—"
              }
            />
            <DetailField
              label={translate("resources.cohorts.fields.program_end_at")}
              value={
                record.program_end_at
                  ? formatISODateString(record.program_end_at)
                  : "—"
              }
            />
            <DetailField
              label={translate("resources.cohorts.fields.minimum_capacity")}
              value={record.minimum_capacity ?? "—"}
            />
            <DetailField
              label={translate("resources.cohorts.fields.target_capacity")}
              value={record.target_capacity ?? "—"}
            />
            <DetailField
              label={translate("resources.cohorts.fields.maximum_capacity")}
              value={record.maximum_capacity ?? "—"}
            />
          </CardContent>
        </Card>
      </Section>
    </div>
  );
};

const DetailField = ({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) => (
  <div className="flex flex-col">
    <span className="text-xs text-muted-foreground tracking-wide">{label}</span>
    <span className="text-sm">{value}</span>
  </div>
);
