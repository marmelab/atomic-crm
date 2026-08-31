import { useState } from "react";
import { useTranslate } from "ra-core";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import { Section } from "../misc/ProgramLayout";
import { formatTimestampString } from "../deals/dealUtils";
import type { WaitlistEntryRow } from "./useWaitlistEntries";
import {
  waitlistEntryStatusBadgeVariant,
  waitlistEntryStatusLabels,
} from "./waitlistConstants";
import { WaitlistEntryActions } from "./WaitlistEntryActions";

// The "Waitlist" section shared by the Living Example, Group Program, and
// Cohort pages (Waitlists slice, §7/§8/§21). A real waitlist can run into
// the dozens (Leif's actual Living Example waitlist is ~50 people), so
// this is a single contained list — one rounded Card, dense divided rows —
// rather than one PersonCard per person; the same "contained list inside a
// rounded section" density pattern the Applications page already
// established for its own many-row sections, not a new visual language.
// Capped at VISIBLE_COUNT with a "show more" toggle (same established
// pattern as dashboard/DashboardTasks.tsx) so 50+ waiting people never
// force the page itself to become enormous.
const VISIBLE_COUNT = 8;

export const WaitlistSection = ({
  entries,
}: {
  entries: WaitlistEntryRow[];
}) => {
  const translate = useTranslate();
  const [expanded, setExpanded] = useState(false);
  const visibleEntries = expanded ? entries : entries.slice(0, VISIBLE_COUNT);
  const remaining = entries.length - visibleEntries.length;

  const title = `${translate("resources.waitlist_entries.name", {
    _: "Waitlist",
    smart_count: 1,
  })} · ${entries.length}`;

  return (
    <Section title={title}>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {translate("resources.waitlist_entries.empty", {
            _: "Nobody waiting.",
          })}
        </p>
      ) : (
        <Card className="p-0">
          <CardContent className="p-0 divide-y">
            {visibleEntries.map((entry) => (
              <div
                key={entry.entryId}
                className="flex items-center justify-between gap-3 px-4 py-2.5"
              >
                <div className="flex min-w-0 flex-1 items-baseline gap-2">
                  <Link
                    to={`/contacts/${entry.contactId}/show`}
                    className="text-sm font-medium hover:underline shrink-0"
                  >
                    {entry.name}
                  </Link>
                  <span className="text-xs text-muted-foreground truncate">
                    {metaFor(entry, (key, fallback) =>
                      translate(key, { _: fallback }),
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    variant={waitlistEntryStatusBadgeVariant[entry.status]}
                  >
                    {waitlistEntryStatusLabels[entry.status]}
                  </Badge>
                  <WaitlistEntryActions
                    entryId={entry.entryId}
                    status={entry.status}
                  />
                </div>
              </div>
            ))}
          </CardContent>
          {remaining > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="text-sm text-muted-foreground underline hover:no-underline text-left px-4 pb-3 pt-1"
            >
              {translate("crm.dashboard.tasks_load_more", {
                _: "%{count} more",
                count: remaining,
              })}
            </button>
          )}
        </Card>
      )}
    </Section>
  );
};

const metaFor = (
  entry: WaitlistEntryRow,
  translate: (key: string, fallback: string) => string,
) => {
  const joinedLabel = translate(
    "resources.waitlist_entries.fields.joined_at",
    "Joined",
  );
  const parts = [`${joinedLabel} ${formatTimestampString(entry.joinedAt)}`];
  if (entry.desiredTiming) parts.push(entry.desiredTiming);
  if (entry.notes) parts.push(entry.notes);
  return parts.join(" · ");
};
