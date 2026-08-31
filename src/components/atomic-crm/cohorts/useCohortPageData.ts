import { useGetList, useGetMany, type Identifier } from "ra-core";

import type { Application, Contact, Deal, Enrollment } from "../types";
import { NON_APPROVED_TERMINAL_APPLICATION_STATUSES } from "../applications/applicationConstants";
import { classifyCohortOpportunity } from "./cohortCapacity";

const ACTIVE_ENROLLMENT_STATUSES: ReadonlySet<Enrollment["status"]> = new Set([
  "onboarding",
  "active",
  "offboarding",
]);

export type CohortEnrolledClient = {
  dealId: Identifier;
  contactId: Identifier;
  name: string;
  status: Enrollment["status"];
};

export type CohortDecidingPerson = {
  dealId: Identifier;
  contactId: Identifier;
  name: string;
  stage: string;
};

export type CohortApplicationRow = {
  applicationId: Identifier;
  dealId: Identifier;
  contactId: Identifier;
  name: string;
  status: Application["status"];
  submittedAt: string;
};

// Backs the Cohort detail page's "Enrolled Clients" / "People Deciding" /
// "Applications" sections (Runtime + Visual Consistency slice, §3):
// real Deal/Enrollment/Application/Contact data grouped by meaning, reusing
// the existing, tested classifyCohortOpportunity rules for the
// enrolled/deciding split rather than reinterpreting them.
export const useCohortPageData = (cohortId?: Identifier) => {
  const { data: deals, isPending: dealsPending } = useGetList<Deal>(
    "deals",
    {
      filter: { cohort_id: cohortId },
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "id", order: "ASC" },
    },
    { enabled: cohortId != null },
  );

  const dealIds = deals?.map((deal) => deal.id) ?? [];
  const opportunityIdList = `(${dealIds.join(",")})`;

  const { data: enrollments, isPending: enrollmentsPending } =
    useGetList<Enrollment>(
      "enrollments",
      {
        filter: { "opportunity_id@in": opportunityIdList },
        pagination: { page: 1, perPage: 1000 },
        sort: { field: "id", order: "ASC" },
      },
      { enabled: !dealsPending },
    );

  const { data: applications, isPending: applicationsPending } =
    useGetList<Application>(
      "applications",
      {
        filter: { "opportunity_id@in": opportunityIdList },
        pagination: { page: 1, perPage: 1000 },
        sort: { field: "submitted_at", order: "DESC" },
      },
      { enabled: !dealsPending },
    );

  const contactIds = [...new Set((deals ?? []).map((deal) => deal.contact_id))];
  const { data: contacts, isPending: contactsPending } = useGetMany<Contact>(
    "contacts",
    { ids: contactIds },
    { enabled: contactIds.length > 0 },
  );

  const isPending =
    dealsPending ||
    enrollmentsPending ||
    applicationsPending ||
    (contactIds.length > 0 && contactsPending);

  if (isPending || !deals) {
    return {
      isPending: true,
      enrolledClients: [] as CohortEnrolledClient[],
      peopleDeciding: [] as CohortDecidingPerson[],
      applications: [] as CohortApplicationRow[],
    };
  }

  const contactById = new Map(
    (contacts ?? []).map((contact) => [String(contact.id), contact]),
  );
  const nameForContact = (contactId: Identifier) => {
    const contact = contactById.get(String(contactId));
    return contact ? `${contact.first_name} ${contact.last_name}` : "";
  };

  const enrollmentByOpportunity = new Map(
    (enrollments ?? []).map((enrollment) => [
      String(enrollment.opportunity_id),
      enrollment,
    ]),
  );
  // "rejected" no longer exists as a single status (Native Applications
  // slice, §1: outcomes are distinct) — any of the three non-approved
  // terminal review outcomes means this person isn't moving toward a
  // purchase anymore. Deal.outcome already carries this once reviewApplication
  // runs, but this stays as a defensive fallback for classifyCohortOpportunity
  // (see its own doc comment).
  const rejectedApplicationOpportunityIds = new Set(
    (applications ?? [])
      .filter((application) =>
        NON_APPROVED_TERMINAL_APPLICATION_STATUSES.has(application.status),
      )
      .map((application) => String(application.opportunity_id)),
  );

  const enrolledClients: CohortEnrolledClient[] = [];
  const peopleDeciding: CohortDecidingPerson[] = [];

  for (const deal of deals) {
    const enrollment = enrollmentByOpportunity.get(String(deal.id));
    const group = classifyCohortOpportunity({
      stage: deal.stage,
      outcome: deal.outcome,
      enrollment,
      hasRejectedApplication: rejectedApplicationOpportunityIds.has(
        String(deal.id),
      ),
    });

    if (
      group === "enrolled" &&
      enrollment &&
      ACTIVE_ENROLLMENT_STATUSES.has(enrollment.status)
    ) {
      enrolledClients.push({
        dealId: deal.id,
        contactId: deal.contact_id,
        name: nameForContact(deal.contact_id),
        status: enrollment.status,
      });
    } else if (group === "in_sales") {
      peopleDeciding.push({
        dealId: deal.id,
        contactId: deal.contact_id,
        name: nameForContact(deal.contact_id),
        stage: deal.stage,
      });
    }
  }

  const applicationRows: CohortApplicationRow[] = (applications ?? []).map(
    (application) => {
      const deal = deals.find(
        (d) => String(d.id) === String(application.opportunity_id),
      );
      return {
        applicationId: application.id,
        dealId: application.opportunity_id,
        contactId: deal?.contact_id ?? "",
        name: deal ? nameForContact(deal.contact_id) : "",
        status: application.status,
        submittedAt: application.submitted_at,
      };
    },
  );

  return {
    isPending: false,
    enrolledClients: enrolledClients.sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
    peopleDeciding: peopleDeciding.sort((a, b) => a.name.localeCompare(b.name)),
    applications: applicationRows,
  };
};
