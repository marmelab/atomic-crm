import { Link } from "react-router";
import { useTranslate, type Identifier } from "ra-core";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";

import { formatTimestampString } from "../deals/dealUtils";
import {
  waitlistEntryStatusBadgeVariant,
  waitlistEntryStatusLabels,
} from "./waitlistConstants";
import { useContactWaitlists } from "./useContactWaitlists";

// ContactShow's "Waitlists" section (Waitlists slice, §10): the Contact's
// full lifetime history, active and historical alike — read-only here
// (status transitions happen from the Program/Cohort page, not here), so a
// past relationship stays visible even after it converts or ends. Heading
// style matches misc/AsideSection.tsx's own mobile/desktop split since
// this is used directly (not wrapped in AsideSection) in both contexts.
export const ContactWaitlists = ({ contactId }: { contactId: Identifier }) => {
  const translate = useTranslate();
  const isMobile = useIsMobile();
  const { isPending, entries } = useContactWaitlists(contactId);

  if (isPending || entries.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 mb-6 text-sm">
      <h3 className={isMobile ? "text-lg font-semibold" : "font-medium pb-1"}>
        {translate("resources.waitlist_entries.name", {
          _: "Waitlists",
          smart_count: 2,
        })}
      </h3>
      <div className="flex flex-col gap-2">
        {entries.map((entry) => (
          <Card key={entry.entryId}>
            <CardContent className="flex items-center justify-between gap-4 py-3">
              <div className="flex min-w-0 flex-col">
                <Link
                  to={entry.programPath}
                  className="text-sm font-medium hover:underline truncate"
                >
                  {entry.cohortName
                    ? `${entry.offerName} — ${entry.cohortName}`
                    : entry.offerName}
                </Link>
                <span className="text-xs text-muted-foreground truncate">
                  {detailLine(entry, translate)}
                </span>
              </div>
              <Badge variant={waitlistEntryStatusBadgeVariant[entry.status]}>
                {waitlistEntryStatusLabels[entry.status]}
              </Badge>
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
