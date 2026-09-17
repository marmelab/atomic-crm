import { useMemo, useState } from "react";
import { useTranslate, type Identifier } from "ra-core";
import { Link } from "react-router";
import { Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { Section } from "../misc/ProgramLayout";
import { formatTimestampString } from "../deals/dealUtils";
import type { WaitlistEntryRow } from "./useWaitlistEntries";
import {
  waitlistEntryStatusBadgeVariant,
  waitlistEntryStatusLabels,
} from "./waitlistConstants";
import { WaitlistEntryActions } from "./WaitlistEntryActions";
import { Checkbox } from "@/components/ui/checkbox";
import { InviteToBookDialog } from "./InviteToBookDialog";
import { isInvitable } from "./waitlistInvitations";
import { isBulkInviteDeliveryEnabled } from "./waitlistInviteFeature";

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

// Human-acceptance repair pass, §1: an 8-row collapse keeps a 50-person
// list from taking over the page, but doesn't make finding ONE person in
// it easy. A tiny local search (name/email — see useWaitlistEntries.ts's
// WaitlistEntryRow.email comment on why not Instagram handle) bypasses the
// collapse for its matches; only shown once the list is actually long
// enough that the collapse (and thus a search) matters.
export const WaitlistSection = ({
  entries,
  offerId,
  offerName,
  cohortId = null,
  cohortName = null,
  // Defaults to the feature flag; an explicit value lets tests exercise
  // both the production (hidden) and post-Gmail (visible) states.
  enableBulkInvite = isBulkInviteDeliveryEnabled(),
}: {
  entries: WaitlistEntryRow[];
  // Optional so a caller that has not been given batch-invite context yet
  // simply renders the list exactly as before.
  offerId?: Identifier;
  offerName?: string;
  cohortId?: Identifier | null;
  cohortName?: string | null;
  enableBulkInvite?: boolean;
}) => {
  const translate = useTranslate();
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [inviteOpen, setInviteOpen] = useState(false);

  // Hidden in production until Gmail delivery exists — a "prepared" batch
  // must never be presented as though people were actually invited.
  const canInvite = enableBulkInvite && offerId != null && offerName != null;
  // Only a membership that has not converted or been removed can be
  // invited. A previously invited one stays selectable on purpose — that
  // is the legitimate re-invite case.
  const invitableEntries = entries.filter(isInvitable);
  const selectedEntries = entries.filter((entry) =>
    selectedIds.has(String(entry.entryId)),
  );
  const allInvitableSelected =
    invitableEntries.length > 0 &&
    invitableEntries.every((entry) => selectedIds.has(String(entry.entryId)));

  const toggleOne = (entryId: Identifier) =>
    setSelectedIds((current) => {
      const next = new Set(current);
      const key = String(entryId);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Select all covers only invitable rows — converted/removed people are
  // never silently swept into a batch.
  const toggleAll = () =>
    setSelectedIds(
      allInvitableSelected
        ? new Set()
        : new Set(invitableEntries.map((entry) => String(entry.entryId))),
    );

  const query = search.trim().toLowerCase();
  const isSearching = query !== "";
  const matchingEntries = useMemo(() => {
    if (!isSearching) return entries;
    return entries.filter(
      (entry) =>
        entry.name.toLowerCase().includes(query) ||
        (entry.email?.toLowerCase().includes(query) ?? false),
    );
  }, [entries, isSearching, query]);

  // Searching always shows every match, regardless of the collapsed state.
  const visibleEntries = isSearching
    ? matchingEntries
    : expanded
      ? matchingEntries
      : matchingEntries.slice(0, VISIBLE_COUNT);
  const remaining = isSearching
    ? 0
    : matchingEntries.length - visibleEntries.length;

  const title = `${translate("resources.waitlist_entries.name", {
    _: "Waitlist",
    smart_count: 1,
  })} · ${entries.length}`;

  return (
    <Section title={title}>
      {canInvite && invitableEntries.length > 0 && (
        <div className="mb-2 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="px-0 text-xs text-muted-foreground"
            onClick={toggleAll}
          >
            {allInvitableSelected
              ? translate("resources.waitlist_entries.invite.clear", {
                  _: "Clear",
                })
              : translate("resources.waitlist_entries.invite.select_all", {
                  _: "Select all",
                })}
          </Button>
          {selectedEntries.length > 0 && (
            <Button type="button" size="sm" onClick={() => setInviteOpen(true)}>
              {translate("resources.waitlist_entries.invite.action", {
                _: "Invite to Book",
              })}{" "}
              · {selectedEntries.length}
            </Button>
          )}
        </div>
      )}
      {canInvite && (
        <InviteToBookDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          offerId={offerId!}
          offerName={offerName!}
          cohortId={cohortId}
          cohortName={cohortName}
          selected={selectedEntries}
          onConfirmed={() => setSelectedIds(new Set())}
        />
      )}
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {translate("resources.waitlist_entries.empty", {
            _: "Nobody waiting.",
          })}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.length > VISIBLE_COUNT && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={translate(
                  "resources.waitlist_entries.search_placeholder",
                  { _: "Search name or email…" },
                )}
                className="h-8 pl-8 pr-8 text-sm"
              />
              {isSearching && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0.5 top-1/2 size-7 -translate-y-1/2"
                  onClick={() => setSearch("")}
                  aria-label={translate("ra.action.clear_input_value", {
                    _: "Clear",
                  })}
                >
                  <X className="size-3.5" />
                </Button>
              )}
            </div>
          )}
          {isSearching && matchingEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground px-1">
              {translate("resources.waitlist_entries.search_empty", {
                _: "No one matches “%{query}”.",
                query: search.trim(),
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
                    {canInvite && (
                      <Checkbox
                        className="shrink-0"
                        aria-label={entry.name}
                        disabled={!isInvitable(entry)}
                        checked={selectedIds.has(String(entry.entryId))}
                        onCheckedChange={() => toggleOne(entry.entryId)}
                      />
                    )}
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
        </div>
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
