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

import { enrollmentStatusLabels } from "./enrollmentConstants";
import type { ClientRow } from "./useClientsGrouped";
import { useClientsGrouped } from "./useClientsGrouped";

// "Clients" is a lifecycle view over the same Contacts, seen through their
// Enrollment — people who completed the sales process and enrolled. No
// separate Person table: the underlying resource is still `enrollments`.
//
// Contracts + Onboarding slice: regrouped into Needs Onboarding / Active /
// Past (architecture review, §9) — same underlying resource, purely
// presentational, mirroring the exact precedent
// applications/ApplicationList.tsx already established for Applications'
// own Needs Review / Reviewed split. Never lets an onboarding client blend
// invisibly into a generic flat list.
export const ClientList = () => {
  const translate = useTranslate();
  const { isPending, needsOnboarding, active, past } = useClientsGrouped();

  if (isPending) return null;

  const isEmpty =
    needsOnboarding.length === 0 && active.length === 0 && past.length === 0;

  return (
    <div className="flex flex-col gap-8 mt-1 p-1 max-w-3xl">
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
          {translate("resources.enrollments.empty", {
            _: "No clients yet.",
          })}
        </p>
      )}

      {needsOnboarding.length > 0 && (
        <ClientGroupSection
          title={translate("resources.enrollments.needs_onboarding", {
            _: "Needs Onboarding",
          })}
          rows={needsOnboarding}
        />
      )}

      {active.length > 0 && (
        <ClientGroupSection
          title={translate("resources.enrollments.active_clients", {
            _: "Active",
          })}
          rows={active}
        />
      )}

      {past.length > 0 && (
        <Accordion type="single" collapsible>
          <AccordionItem value="past" className="border-none">
            <AccordionTrigger className="text-lg font-semibold hover:no-underline py-0">
              {translate("resources.enrollments.past_clients", {
                _: "Past Clients",
              })}
              <span className="text-sm font-normal text-muted-foreground ml-auto mr-2">
                {past.length}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="pt-2">
                <ClientRows rows={past} />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
};

const ClientGroupSection = ({
  title,
  rows,
}: {
  title: string;
  rows: ClientRow[];
}) => (
  <div className="flex flex-col gap-2">
    <h2 className="text-lg font-semibold">{title}</h2>
    <ClientRows rows={rows} />
  </div>
);

const ClientRows = ({ rows }: { rows: ClientRow[] }) => (
  <Card className="p-0">
    <CardContent className="p-0 divide-y">
      {rows.map((row) => (
        <Link
          key={row.enrollment.id}
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
              {row.offer?.name}
              {row.cohort ? ` — ${row.cohort.name}` : ""}
            </span>
          </div>
          <Badge
            variant={
              row.enrollment.status === "completed" ? "secondary" : "outline"
            }
          >
            {enrollmentStatusLabels[row.enrollment.status]}
          </Badge>
        </Link>
      ))}
    </CardContent>
  </Card>
);
