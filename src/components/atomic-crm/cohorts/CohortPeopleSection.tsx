import { Link } from "react-router";
import { useGetMany, useRecordContext, useTranslate } from "ra-core";

import type { Cohort, Contact } from "../types";
import type { CohortPerson } from "./useCohortCapacity";
import { useCohortCapacity } from "./useCohortCapacity";

// "Enrolled" = an active-lifecycle Enrollment (Onboarding/Active/
// Offboarding) tied to this Cohort. "In Sales" = still selling, not yet
// Won/enrolled, and not exited. Both come straight from the underlying
// deals/enrollments relationships — no separately maintained counter.
export const CohortPeopleSection = () => {
  const record = useRecordContext<Cohort>();
  const translate = useTranslate();
  const { isPending, people } = useCohortCapacity(record?.id);

  if (!record) return null;
  if (isPending) return null;

  const enrolled = people.filter((p) => p.group === "enrolled");
  const inSales = people.filter((p) => p.group === "in_sales");

  return (
    <div className="flex flex-col gap-4 mt-4">
      <h3 className="text-base font-medium">
        {translate("resources.cohorts.people.title", { _: "People" })}
      </h3>
      <PeopleGroup
        title={translate("resources.cohorts.people.enrolled", {
          _: "Enrolled",
        })}
        people={enrolled}
      />
      <PeopleGroup
        title={translate("resources.cohorts.people.in_sales", {
          _: "In Sales",
        })}
        people={inSales}
      />
    </div>
  );
};

const PeopleGroup = ({
  title,
  people,
}: {
  title: string;
  people: CohortPerson[];
}) => {
  const translate = useTranslate();
  const { data: contacts } = useGetMany<Contact>(
    "contacts",
    { ids: people.map((p) => p.deal.contact_id) },
    { enabled: people.length > 0 },
  );

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
        {title} ({people.length})
      </p>
      {people.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {translate("resources.cohorts.people.empty", { _: "Nobody yet." })}
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {people.map(({ deal }) => {
            const contact = contacts?.find(
              (c) => String(c.id) === String(deal.contact_id),
            );
            return (
              <li key={deal.id} className="text-sm">
                <Link
                  to={`/deals/${deal.id}/show`}
                  className="underline hover:no-underline"
                >
                  {contact
                    ? `${contact.first_name} ${contact.last_name}`
                    : deal.name}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
