import { Link } from "react-router";
import { useTranslate, type Identifier } from "ra-core";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";

import { formatTimestampString } from "../deals/dealUtils";
import { humanizeCohortName } from "../cohorts/humanizeCohortName";
import { ContactAddToWaitlistButton } from "./ContactAddToWaitlistButton";
import { ContactWaitlistConvertButton } from "./ContactWaitlistConvertButton";
import { ContactWaitlistRemoveButton } from "./ContactWaitlistRemoveButton";
import {
  ACTIVE_WAITLIST_STATUSES,
  waitlistEntryStatusBadgeVariant,
  waitlistEntryStatusLabels,
} from "./waitlistConstants";
import { useContactWaitlists } from "./useContactWaitlists";

// ContactShow's "Waitlists" section (Waitlists slice, §10, actionability
// improved in the Human-acceptance repair pass, §3A/§7): the Contact's
// full lifetime history, active and historical alike, so a past
// relationship stays visible even after it converts or ends. A historical
// (converted/removed) row stays pure read-only; an active (waiting/
// invited) one additionally gets its own "Convert to Opportunity" button —
// once a compatible active Opportunity exists, the centralized sync
// (waitlist/waitlistSync.ts) will already have flipped the entry to
// Converted, so this button never has to guard against "already has one"
// itself. Heading style matches misc/AsideSection.tsx's own mobile/
// desktop split since this is used directly (not wrapped in AsideSection)
// in both contexts.
export const ContactWaitlists = ({ contactId }: { contactId: Identifier }) => {
  const translate = useTranslate();
  const isMobile = useIsMobile();
  const { isPending, entries } = useContactWaitlists(contactId);

  // Renders even with no entries now: the section header carries the
  // Contact's "Add to Waitlist" action, which is the only entry point for
  // putting THIS person on a waitlist — hiding the whole section when empty
  // would hide the action exactly when it is most needed.
  if (isPending) return null;

  return (
    <div className="flex flex-col gap-2 mb-6 text-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className={isMobile ? "text-lg font-semibold" : "font-medium pb-1"}>
          {translate("resources.waitlist_entries.name", {
            _: "Waitlists",
            smart_count: 2,
          })}
        </h3>
        <ContactAddToWaitlistButton contactId={contactId} />
      </div>
      {entries.length === 0 && (
        <p className="text-xs text-muted-foreground">
          {translate("resources.waitlist_entries.contact_detail.empty", {
            _: "Not on any waitlist.",
          })}
        </p>
      )}
      <div className="flex flex-col gap-2">
        {entries.map((entry) => (
          <Card key={entry.entryId} className="p-0">
            <CardContent className="flex flex-col gap-1.5 px-4 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-col">
                  <Link
                    to={entry.programPath}
                    className="text-sm font-medium hover:underline truncate"
                  >
                    {/* A canonical cohort name already embeds its Offer
                        ("Growing Yourself Up — Fall 2026"), so prefixing
                        the Offer again read as "Growing Yourself Up —
                        Growing Yourself Up — Fall 2026". humanizeCohortName
                        strips whichever redundant form the name uses. */}
                    {entry.cohortName
                      ? `${entry.offerName} — ${humanizeCohortName(
                          entry.cohortName,
                          entry.offerName,
                        )}`
                      : entry.offerName}
                  </Link>
                  <span className="text-xs text-muted-foreground truncate">
                    {detailLine(entry, translate)}
                  </span>
                </div>
                <Badge
                  variant={waitlistEntryStatusBadgeVariant[entry.status]}
                  className="shrink-0"
                >
                  {waitlistEntryStatusLabels[entry.status]}
                </Badge>
              </div>
              {ACTIVE_WAITLIST_STATUSES.has(entry.status) && (
                <div className="flex items-center gap-2">
                  <ContactWaitlistConvertButton entryId={entry.entryId} />
                  {/* Remove is a lifecycle transition to Removed, never a
                      delete — the row stays on this list as history. */}
                  <ContactWaitlistRemoveButton entryId={entry.entryId} />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

const detailLine = (
  entry: ReturnType<typeof useContactWaitlists>["entries"][number],
  translate: (key: string, options: Record<string, unknown>) => string,
) => {
  const parts = [
    translate("resources.waitlist_entries.contact_detail.joined", {
      _: "Joined %{date}",
      date: formatTimestampString(entry.joinedAt),
    }),
  ];
  if (entry.desiredTiming) {
    parts.push(
      translate("resources.waitlist_entries.contact_detail.preferred", {
        _: "Preferred timing: %{timing}",
        timing: entry.desiredTiming,
      }),
    );
  }
  if (entry.convertedAt) {
    parts.push(
      translate("resources.waitlist_entries.contact_detail.converted", {
        _: "Converted %{date}",
        date: formatTimestampString(entry.convertedAt),
      }),
    );
  }
  if (entry.removedAt) {
    parts.push(
      translate("resources.waitlist_entries.contact_detail.removed", {
        _: "Removed %{date}",
        date: formatTimestampString(entry.removedAt),
      }),
    );
  }
  return parts.join(" · ");
};
