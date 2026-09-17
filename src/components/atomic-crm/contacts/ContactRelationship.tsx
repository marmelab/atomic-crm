import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Plus } from "lucide-react";
import {
  InfiniteListBase,
  useGetList,
  useTranslate,
  type Identifier,
} from "ra-core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { Application, Deal, Enrollment, Offer } from "../types";
import { formatTimestampString } from "../deals/dealUtils";
import { NoteCreate } from "../notes";
import { ContactSalesAction } from "../waitlist/ContactSalesAction";
import { ContactWaitlists } from "../waitlist/ContactWaitlists";
import { useContactHistory } from "./useContactHistory";

// The Contact page's main canvas: what this human has actually done with
// the business. Two designed objects, not a scatter of floating labels —
// one Relationship panel with internal rows, then History directly
// beneath it.
//
// Rows deliberately name the OFFER, never "<Person> — <Offer>": the page
// heading already says who this is, so repeating it in every row is noise.
export const ContactRelationship = ({
  contactId,
}: {
  contactId: Identifier;
}) => (
  <div className="flex flex-col gap-6">
    <CurrentRelationship contactId={contactId} />
    <RelationshipHistory contactId={contactId} />
  </div>
);

const Panel = ({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <section className="rounded-lg border">
    <header className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
      <h3 className="text-sm font-medium">{title}</h3>
      {action}
    </header>
    {children}
  </section>
);

// One internal subsection of the Relationship panel. Rows are separated by
// a hairline rather than boxed into their own cards, so the panel reads as
// a single object.
const PanelRow = ({
  label,
  meta,
  badge,
  to,
}: {
  label: string;
  meta?: string | null;
  badge?: React.ReactNode;
  to?: string;
}) => (
  <div className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
    <div className="flex min-w-0 flex-col">
      {to ? (
        <Link to={to} className="truncate hover:underline">
          {label}
        </Link>
      ) : (
        <span className="truncate">{label}</span>
      )}
      {meta && (
        <span className="truncate text-xs text-muted-foreground">{meta}</span>
      )}
    </div>
    {badge}
  </div>
);

const GroupLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="px-4 pt-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
    {children}
  </div>
);

const StatusBadge = ({
  children,
  active,
}: {
  children: React.ReactNode;
  active: boolean;
}) => (
  <Badge
    variant={active ? "default" : "outline"}
    className="shrink-0 capitalize"
  >
    {children}
  </Badge>
);

const CurrentRelationship = ({ contactId }: { contactId: Identifier }) => {
  const translate = useTranslate();
  const { data: deals } = useGetList<Deal>("deals", {
    filter: { contact_id: contactId },
    pagination: { page: 1, perPage: 100 },
    sort: { field: "created_at", order: "DESC" },
  });
  // Gate A: an Application belongs to a Contact directly. Resolving them
  // through Opportunities would silently hide every applicant who never
  // became one — exactly the defect Gate A fixed.
  const { data: applications } = useGetList<Application>("applications", {
    filter: { contact_id: contactId },
    pagination: { page: 1, perPage: 100 },
    sort: { field: "submitted_at", order: "DESC" },
  });
  const { data: offers } = useGetList<Offer>("offers", {
    filter: {},
    pagination: { page: 1, perPage: 100 },
    sort: { field: "id", order: "ASC" },
  });
  const dealIds = (deals ?? []).map((deal) => deal.id);
  const { data: enrollments } = useGetList<Enrollment>(
    "enrollments",
    {
      filter: { "opportunity_id@in": `(${dealIds.join(",")})` },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "id", order: "DESC" },
    },
    { enabled: dealIds.length > 0 },
  );

  const isActiveDeal = (deal: Deal) =>
    deal.archived_at == null && deal.stage !== "won" && deal.outcome == null;
  const offerName = (offerId: Identifier | null | undefined) =>
    (offers ?? []).find((o) => String(o.id) === String(offerId))?.name ?? "";
  const dealOfferName = (dealId: Identifier | null | undefined) => {
    const deal = (deals ?? []).find((d) => String(d.id) === String(dealId));
    return deal ? offerName(deal.offer_id) : "";
  };

  const hasAny =
    (enrollments ?? []).length > 0 ||
    (deals ?? []).length > 0 ||
    (applications ?? []).length > 0;

  return (
    <Panel
      title={translate("resources.contacts.relationship", {
        _: "Relationship",
      })}
      action={<ContactSalesAction contactId={contactId} />}
    >
      <div className="divide-y">
        {(enrollments ?? []).length > 0 && (
          <div>
            <GroupLabel>
              {translate("resources.enrollments.name", {
                _: "Programmes",
                smart_count: 2,
              })}
            </GroupLabel>
            {(enrollments ?? []).map((enrollment) => (
              <PanelRow
                key={enrollment.id}
                to={`/enrollments/${enrollment.id}/show`}
                label={dealOfferName(enrollment.opportunity_id)}
                badge={
                  <StatusBadge active={enrollment.status !== "completed"}>
                    {enrollment.status.replace(/_/g, " ")}
                  </StatusBadge>
                }
              />
            ))}
          </div>
        )}

        {(deals ?? []).length > 0 && (
          <div>
            <GroupLabel>
              {translate("resources.deals.name", {
                _: "Opportunities",
                smart_count: 2,
              })}
            </GroupLabel>
            {(deals ?? []).map((deal) => (
              <PanelRow
                key={deal.id}
                to={`/deals/${deal.id}/show`}
                label={offerName(deal.offer_id)}
                badge={
                  <StatusBadge active={isActiveDeal(deal)}>
                    {deal.outcome
                      ? deal.outcome.replace(/_/g, " ")
                      : deal.stage.replace(/_/g, " ")}
                  </StatusBadge>
                }
              />
            ))}
          </div>
        )}

        {(applications ?? []).length > 0 && (
          <div>
            <GroupLabel>
              {translate("resources.applications.name", {
                _: "Applications",
                smart_count: 2,
              })}
            </GroupLabel>
            {(applications ?? []).map((application) => (
              <PanelRow
                key={application.id}
                to={`/applications/${application.id}/show`}
                label={offerName(application.offer_id) || "Application"}
                meta={formatTimestampString(application.submitted_at)}
                badge={
                  <StatusBadge active={application.status === "pending"}>
                    {application.status.replace(/_/g, " ")}
                  </StatusBadge>
                }
              />
            ))}
          </div>
        )}

        {/* Waitlists keep their own presentation — program/cohort/status,
            join + removal dates, and the Remove/Convert actions. */}
        <div className="px-4 pt-3 pb-1">
          <ContactWaitlists contactId={contactId} />
        </div>

        {!hasAny && (
          <p className="px-4 py-3 text-xs text-muted-foreground">
            No programmes, opportunities or applications yet.
          </p>
        )}
      </div>
    </Panel>
  );
};

const VISIBLE_EVENTS = 8;

const RelationshipHistory = ({ contactId }: { contactId: Identifier }) => {
  const { isPending, events, sessionCount } = useContactHistory(contactId);
  const [expanded, setExpanded] = useState(false);
  const [composing, setComposing] = useState(false);

  // Collapse the composer once the note actually lands. NoteCreate owns its
  // own submit handling and exposes no success callback, so this keys off
  // the observable result — a new History row — rather than guessing from
  // a form event that never bubbles.
  const eventCount = events.length;
  const countWhenOpened = useRef<number | null>(null);
  useEffect(() => {
    if (!composing) {
      countWhenOpened.current = null;
      return;
    }
    if (countWhenOpened.current == null) {
      countWhenOpened.current = eventCount;
      return;
    }
    if (eventCount > countWhenOpened.current) setComposing(false);
  }, [composing, eventCount]);

  if (isPending) return null;

  const visible = expanded ? events : events.slice(0, VISIBLE_EVENTS);
  const remaining = events.length - visible.length;

  return (
    <Panel
      title="History"
      // Note creation lives on the History header, where notes are read.
      // It was previously a lone button below the fold that Leif could not
      // find at all.
      action={
        <div className="flex items-center gap-3">
          {/* Sessions are summarized, never expanded inline: an active
              client has dozens and they would bury the relationship. */}
          {sessionCount > 0 && (
            <Link
              to={`/client-sessions?filter=${encodeURIComponent(
                JSON.stringify({ contact_id: contactId }),
              )}`}
              className="text-xs text-muted-foreground hover:underline"
            >
              Sessions · {sessionCount}
            </Link>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setComposing((open) => !open)}
          >
            <Plus className="size-4" />
            Add note
          </Button>
        </div>
      }
    >
      {composing && (
        <div className="border-b px-4 py-3">
          <ContactNoteComposer contactId={contactId} />
        </div>
      )}

      {events.length === 0 ? (
        <p className="px-4 py-3 text-xs text-muted-foreground">
          Nothing recorded yet.
        </p>
      ) : (
        <>
          <ol className="divide-y">
            {visible.map((event) => (
              <li key={event.id} className="flex gap-4 px-4 py-2 text-sm">
                <span className="w-24 shrink-0 pt-0.5 text-xs text-muted-foreground tabular-nums">
                  {formatTimestampString(event.at)}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={
                      event.tone === "active" ? "" : "text-muted-foreground"
                    }
                  >
                    {event.label}
                  </span>
                  {event.detail && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {event.detail}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
          {remaining > 0 && (
            <div className="border-t px-4 py-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="px-0 text-xs text-muted-foreground"
                onClick={() => setExpanded(true)}
              >
                Show {remaining} earlier
              </Button>
            </div>
          )}
        </>
      )}
    </Panel>
  );
};

// The composer lives inside the panel it writes into, and collapses once
// the note is saved — the saved note then appears as a History row with
// its own real timestamp, which is where notes are read from now.
const ContactNoteComposer = ({ contactId }: { contactId: Identifier }) => (
  // NoteCreate resolves its target resource from context AND calls
  // useListContext().refetch after saving, so it needs a real notes list
  // context around it — it previously inherited both from the notes list
  // it was rendered inside. This supplies exactly those contexts without
  // rendering a second copy of the notes (History already shows them).
  <InfiniteListBase
    resource="contact_notes"
    filter={{ contact_id: contactId }}
    sort={{ field: "date", order: "DESC" }}
    perPage={25}
    disableSyncWithLocation
    storeKey={false}
  >
    <NoteCreate reference="contacts" showStatus />
  </InfiniteListBase>
);
