import { useTranslate } from "ra-core";
import { Link } from "react-router";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ReferenceField } from "@/components/admin/reference-field";

import { formatISODateString } from "../deals/dealUtils";
import { enrollmentStatusLabels } from "./enrollmentConstants";
import type { ClientRow, CohortGroup } from "./useClientsGrouped";
import { useClientsGrouped } from "./useClientsGrouped";

// "Clients" is a lifecycle view over the same Contacts, seen through their
// Enrollment. No separate Person table: the underlying resource is still
// `enrollments`.
//
// Split by Offer first, because LE and GYU are operationally different
// shapes and merging them hid the distinction: The Living Example is a
// rolling 1:1 container with its own dates per person, so it reads
// Current / Upcoming / Past; Growing Yourself Up runs as a cohort, so it
// reads by cohort. A single "Active" blob answered neither question.
export const ClientList = () => {
  const translate = useTranslate();
  const { isPending, livingExample, gyuCohorts, gyuPast, other } =
    useClientsGrouped();

  if (isPending) return null;

  const isEmpty =
    livingExample.current.length === 0 &&
    livingExample.upcoming.length === 0 &&
    livingExample.past.length === 0 &&
    gyuCohorts.length === 0 &&
    gyuPast.length === 0 &&
    other.length === 0;

  return (
    <div className="flex flex-col gap-10 mt-1 p-1 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">
          {translate("resources.enrollments.name", { smart_count: 2 })}
        </h1>
        <p className="text-sm text-muted-foreground">
          {translate("resources.enrollments.orientation")}
        </p>
      </div>

      {isEmpty && (
        <p className="text-sm text-muted-foreground">
          {translate("resources.enrollments.empty", { _: "No clients yet." })}
        </p>
      )}

      {(livingExample.current.length > 0 ||
        livingExample.upcoming.length > 0 ||
        livingExample.past.length > 0) && (
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">The Living Example</h2>

          {livingExample.current.length > 0 && (
            <Group
              title={translate("resources.enrollments.current_clients", {
                _: "Current",
              })}
              // Says the order out loud so it is not something Leif has to
              // infer from the rows.
              hint={translate("resources.enrollments.current_order_hint", {
                _: "Newest start first",
              })}
              rows={livingExample.current}
            />
          )}

          {livingExample.upcoming.length > 0 && (
            <Group
              title={translate("resources.enrollments.upcoming_clients", {
                _: "Upcoming",
              })}
              hint={translate("resources.enrollments.upcoming_order_hint", {
                _: "Starting soonest first",
              })}
              rows={livingExample.upcoming}
            />
          )}

          {livingExample.past.length > 0 && (
            <CollapsedGroup
              value="le-past"
              title={translate("resources.enrollments.past_clients", {
                _: "Past",
              })}
              rows={livingExample.past}
            />
          )}
        </section>
      )}

      {(gyuCohorts.length > 0 || gyuPast.length > 0) && (
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Growing Yourself Up</h2>

          {gyuCohorts.map((group: CohortGroup) => (
            <Group key={group.key} title={group.title} rows={group.rows} />
          ))}

          {gyuPast.length > 0 && (
            <CollapsedGroup
              value="gyu-past"
              title={translate("resources.enrollments.past_cohort_clients", {
                _: "Past & withdrawn",
              })}
              rows={gyuPast}
            />
          )}
        </section>
      )}

      {other.length > 0 && (
        <Group
          title={translate("resources.enrollments.other_clients", {
            _: "Other",
          })}
          rows={other}
        />
      )}
    </div>
  );
};

const Group = ({
  title,
  hint,
  rows,
}: {
  title: string;
  hint?: string;
  rows: ClientRow[];
}) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-baseline gap-2">
      <h3 className="text-base font-semibold">{title}</h3>
      <span className="text-sm text-muted-foreground">{rows.length}</span>
      {hint && (
        <span className="text-xs text-muted-foreground ml-auto">{hint}</span>
      )}
    </div>
    <ClientRows rows={rows} />
  </div>
);

const CollapsedGroup = ({
  value,
  title,
  rows,
}: {
  value: string;
  title: string;
  rows: ClientRow[];
}) => (
  <Accordion type="single" collapsible>
    <AccordionItem value={value} className="border-none">
      <AccordionTrigger className="text-base font-semibold hover:no-underline py-0">
        {title}
        <span className="text-sm font-normal text-muted-foreground ml-auto mr-2">
          {rows.length}
        </span>
      </AccordionTrigger>
      <AccordionContent>
        <div className="pt-2">
          <ClientRows rows={rows} />
        </div>
      </AccordionContent>
    </AccordionItem>
  </Accordion>
);

// The container's dates belong on the row. Leif should not have to open a
// client to find out when their programme runs, and an unset end date says
// so rather than being left blank or invented.
const containerDates = (row: ClientRow): string => {
  const start = row.enrollment.start_date
    ? `Starts ${formatISODateString(row.enrollment.start_date)}`
    : "Start date not set";
  const end = row.enrollment.end_date
    ? `Ends ${formatISODateString(row.enrollment.end_date)}`
    : "End date not set";
  return `${start} · ${end}`;
};

const ClientRows = ({ rows }: { rows: ClientRow[] }) => (
  <Card className="p-0">
    <CardContent className="p-0 divide-y">
      {rows.map((row) => (
        <Link
          key={row.enrollment.id}
          // The Enrollment, not the Contact: this is the client container,
          // and the generic Contact page does not show start/end dates,
          // payment state, onboarding or sessions.
          to={`/enrollments/${row.enrollment.id}/show`}
          className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/50 transition-colors"
        >
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-medium truncate">
              {row.contactId != null ? (
                <ReferenceField
                  source="contactId"
                  reference="contacts"
                  record={{ id: row.enrollment.id, contactId: row.contactId }}
                  link={false}
                />
              ) : (
                "—"
              )}
            </span>
            <span className="text-xs text-muted-foreground truncate">
              {containerDates(row)}
            </span>
            <span className="text-xs text-muted-foreground truncate">
              {row.offer?.name}
              {row.cohort ? ` — ${row.cohort.name}` : ""}
            </span>
          </div>
          <Badge
            variant={row.phase === "past" ? "secondary" : "outline"}
            className="shrink-0"
          >
            {row.phase === "upcoming"
              ? "Upcoming"
              : enrollmentStatusLabels[row.enrollment.status]}
          </Badge>
        </Link>
      ))}
    </CardContent>
  </Card>
);
