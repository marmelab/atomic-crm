import { useState } from "react";
import {
  useDataProvider,
  useNotify,
  useRecordContext,
  useRefresh,
  useTranslate,
} from "ra-core";
import type { Identifier } from "ra-core";
import { Link } from "react-router";

import { EditButton } from "@/components/admin/edit-button";
import { Show } from "@/components/admin/show";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";

import { Avatar } from "../contacts/Avatar";
import {
  formatISODateString,
  formatMonthDayString,
  formatTimestampWithTimeString,
} from "../deals/dealUtils";
import { formatOfferPageAmount } from "../deals/offerPageMoney";
import { formatRemainingInstallmentsCopy } from "../deals/paymentPlanRemainingCopy";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { CadenceResolutionModal } from "../sessions/CadenceResolutionModal";
import { formatWindowWeekLabel } from "../sessions/cadenceWeekLabel";
import { findNoShowSessionInSlot } from "../sessions/findNoShowSessionInSlot";
import { markClientSessionNoShow } from "../sessions/markClientSessionNoShow";
import { reverseClientSessionNoShow } from "../sessions/reverseClientSessionNoShow";
import type { ExpectedWeekSummary } from "../sessions/computeClientSessionCadenceSummary";
import { useClientSessionCadence } from "../sessions/useClientSessionCadence";
import type {
  ClientSession,
  Enrollment,
  EnrollmentOnboardingItem,
  Offer,
} from "../types";
import { activateEnrollment } from "./activateEnrollment";
import { completeOnboardingItem } from "./completeOnboardingItem";
import { enrollmentStatusLabels } from "./enrollmentConstants";
import { reopenOnboardingItem } from "./reopenOnboardingItem";
import { useEnrollmentOperationalData } from "./useEnrollmentOperationalData";

// Contracts + Onboarding slice: the Enrollment/Client page rebuilt as the
// real operational home for onboarding (architecture review, §9) — Contact/
// Offer/Cohort/status (kept from the previous bare admin scaffold),
// authoritative payment context (from the Deal's own frozen snapshot, never
// client-supplied), the onboarding checklist, and the explicit Activate
// action. Human-acceptance repair: deliberately does NOT also render a
// separate Tasks list — the checklist IS the human-facing representation
// of that same work (each row shows its own linked Task's text as a small
// hint when incomplete); a second list underneath just duplicated it,
// showing five indistinguishable rows. The underlying Tasks still exist
// and still surface normally on the Dashboard/Contact page/etc.
export const ClientShow = () => (
  <Show actions={<EditButton />}>
    <EnrollmentOperationalHome />
  </Show>
);

const EnrollmentOperationalHome = () => {
  const enrollment = useRecordContext<Enrollment>();
  const { currency } = useConfigurationContext();
  const { isPending, deal, contact, offer, cohort, items, tasks } =
    useEnrollmentOperationalData(enrollment);

  if (isPending || !enrollment || !deal || !offer) return null;

  const contactName = contact
    ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim()
    : deal.name;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        {contact && <Avatar />}
        <div className="flex flex-col">
          {/* Human-acceptance repair: Leif may not remember who this is
              mid-onboarding and needs their persistent Contact history —
              the direct relationship already on the Deal, never a
              heuristic guess. Visibly a link (underline-on-hover) but
              styled like the plain name it replaces, not a loud CTA. */}
          <span className="text-lg font-semibold">
            {contact ? (
              <Link
                to={`/contacts/${contact.id}/show`}
                className="hover:underline"
              >
                {contactName}
              </Link>
            ) : (
              contactName
            )}
          </span>
          <span className="text-sm text-muted-foreground">
            {offer.name}
            {cohort ? ` — ${cohort.name}` : ""}
          </span>
          {enrollment.start_date && (
            <span className="text-xs text-muted-foreground">
              {formatISODateString(enrollment.start_date)}
              {enrollment.end_date
                ? ` – ${formatISODateString(enrollment.end_date)}`
                : ""}
            </span>
          )}
        </div>
        <Badge
          className="ml-auto"
          variant={enrollment.status === "completed" ? "secondary" : "outline"}
        >
          {enrollmentStatusLabels[enrollment.status]}
        </Badge>
      </div>

      <PaymentContextCard deal={deal} currency={currency} />

      <OnboardingChecklistCard
        enrollment={enrollment}
        items={items}
        tasks={tasks}
      />

      {/* Client + Session Operations slice A: only for an ACTIVE Enrollment
          whose Offer actually has paid-client-session tracking configured
          (currently only The Living Example) — an onboarding/offboarding/
          completed Enrollment, or an Offer with no session mapping at all
          (e.g. Growing Yourself Up — group-session attendance is out of
          scope for this slice), simply doesn't show this section rather
          than rendering an empty/meaningless one. */}
      {enrollment.status === "active" &&
        offer.client_session_acuity_appointment_type_id != null && (
          <SessionsCard enrollment={enrollment} offer={offer} />
        )}
    </div>
  );
};

const PaymentContextCard = ({
  deal,
  currency,
}: {
  deal: NonNullable<ReturnType<typeof useEnrollmentOperationalData>["deal"]>;
  currency: string;
}) => {
  const translate = useTranslate();
  const installments = deal.selected_installment_count ?? 1;
  const installmentAmount =
    deal.selected_installment_amount ?? deal.selected_payment_total ?? 0;

  return (
    <Card>
      <CardContent className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground tracking-wide">
          {translate("resources.enrollments.payment_context", {
            _: "Payment",
          })}
        </span>
        <span className="text-lg font-semibold">
          {deal.offer_name_snapshot} —{" "}
          {formatOfferPageAmount(deal.offer_price_snapshot ?? 0, currency)}
        </span>
        {installments > 1 ? (
          <span className="text-sm text-muted-foreground">
            {formatRemainingInstallmentsCopy(
              installments,
              installmentAmount,
              currency,
            )}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">
            {translate("resources.enrollments.paid_in_full", {
              _: "Paid in full.",
            })}
          </span>
        )}
      </CardContent>
    </Card>
  );
};

const OnboardingChecklistCard = ({
  enrollment,
  items,
  tasks,
}: {
  enrollment: Enrollment;
  items: EnrollmentOnboardingItem[];
  tasks: ReturnType<typeof useEnrollmentOperationalData>["tasks"];
}) => {
  const translate = useTranslate();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [pendingItemId, setPendingItemId] = useState<
    EnrollmentOnboardingItem["id"] | null
  >(null);
  const [activating, setActivating] = useState(false);

  const requiredItems = items.filter((item) => item.is_required);
  const optionalItems = items.filter((item) => !item.is_required);
  const requiredDoneCount = requiredItems.filter(
    (item) => item.status === "done",
  ).length;
  const readyToActivate =
    enrollment.status === "onboarding" &&
    requiredItems.length > 0 &&
    requiredDoneCount === requiredItems.length;

  const toggleItem = async (item: EnrollmentOnboardingItem) => {
    // Human-acceptance repair, round 4: the checkbox itself is NEVER passed
    // `disabled` (see OnboardingItemRow below) — a genuinely `disabled`
    // control is exactly what index.css's own `button:disabled { cursor:
    // not-allowed }` rule (and the shadcn Checkbox's own
    // `disabled:cursor-not-allowed`) correctly fires on, which is what
    // flashed the prohibited cursor for the ~1s a real Supabase round-trip
    // takes. Re-entrancy is guarded here instead — a click on the SAME item
    // while its own mutation is still in flight is a safe no-op, exactly as
    // idempotent as before, but without the DOM ever reporting the control
    // as disabled. Sibling rows were never blocked by the old `disabled`
    // prop either (it was scoped to `pendingItemId === item.id`), so this
    // preserves that same per-item (not blanket) scope.
    if (pendingItemId === item.id) return;
    setPendingItemId(item.id);
    try {
      if (item.status === "done") {
        await reopenOnboardingItem(dataProvider, item.id);
      } else {
        await completeOnboardingItem(dataProvider, item.id);
      }
    } catch {
      notify("ra.notification.http_error", { type: "error" });
    } finally {
      setPendingItemId(null);
      refresh();
    }
  };

  // 'sent' is an informational middle step for the 'contract' item only —
  // never completes it (and never touches its linked Task): Leif still
  // has to explicitly mark it done once it's actually signed.
  const markContractSent = async (item: EnrollmentOnboardingItem) => {
    setPendingItemId(item.id);
    try {
      await dataProvider.update("enrollment_onboarding_items", {
        id: item.id,
        data: { status: "sent" },
        previousData: item,
      });
    } catch {
      notify("ra.notification.http_error", { type: "error" });
    } finally {
      setPendingItemId(null);
      refresh();
    }
  };

  const handleActivate = async () => {
    setActivating(true);
    try {
      const result = await activateEnrollment(dataProvider, enrollment.id);
      if (!result.applied) {
        notify(
          result.reason === "not-onboarding"
            ? "resources.enrollments.already_activated"
            : "resources.enrollments.activation_incomplete",
          {
            type: "warning",
            _:
              result.reason === "not-onboarding"
                ? "This Enrollment is no longer awaiting onboarding — showing the current state."
                : "Some required items are still incomplete — showing the current state.",
          },
        );
      } else {
        notify("resources.enrollments.activated", {
          type: "info",
          _: "Enrollment activated.",
        });
      }
    } catch {
      notify("ra.notification.http_error", { type: "error" });
    } finally {
      setActivating(false);
      refresh();
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Human-acceptance repair: a disabled, unexplained Activate button
          throughout onboarding read as mysterious — Leif didn't know what
          it meant. It now only ever appears once it's actually clickable;
          before that, plain progress is the only thing shown. Once Active,
          neither shows again — the status Badge above already says so. */}
      <div className="flex items-center justify-between">
        {enrollment.status === "onboarding" && readyToActivate ? (
          <span className="text-sm font-medium text-foreground">
            {translate("resources.enrollments.onboarding_complete", {
              _: "Onboarding complete",
            })}
          </span>
        ) : (
          <h3 className="text-sm font-medium text-muted-foreground">
            {translate("resources.enrollments.onboarding_checklist", {
              _: "Onboarding",
            })}
            {requiredItems.length > 0 &&
              ` ${requiredDoneCount}/${requiredItems.length}`}
          </h3>
        )}
        {enrollment.status === "onboarding" && readyToActivate && (
          <Button size="sm" disabled={activating} onClick={handleActivate}>
            {activating
              ? translate("resources.enrollments.activating", {
                  _: "Activating…",
                })
              : translate("resources.enrollments.activate", {
                  _: "Activate client",
                })}
          </Button>
        )}
      </div>
      <Card>
        <CardContent className="flex flex-col divide-y">
          {[...requiredItems, ...optionalItems].map((item) => (
            <OnboardingItemRow
              key={item.id}
              item={item}
              tasks={tasks}
              disabled={pendingItemId === item.id}
              onToggle={() => toggleItem(item)}
              onMarkSent={() => markContractSent(item)}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

const OnboardingItemRow = ({
  item,
  tasks,
  disabled,
  onToggle,
  onMarkSent,
}: {
  item: EnrollmentOnboardingItem;
  tasks: ReturnType<typeof useEnrollmentOperationalData>["tasks"];
  disabled: boolean;
  onToggle: () => void;
  onMarkSent: () => void;
}) => {
  const translate = useTranslate();
  // The item's own label already describes the COMPLETED state ("Contract
  // signed", "Slack access") regardless of current status — the checkbox
  // (and, for 'contract', the Sent badge below) is what communicates
  // where it currently stands. No done-vs-pending relabeling needed.
  const isDone = item.status === "done";
  const isContract = item.requirement_key === "contract";
  const linkedTask = tasks.find(
    (task) => task.onboarding_item_id === item.id && !task.done_date,
  );

  return (
    <div className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      {/* No `disabled` here on purpose (human-acceptance repair, round 4 —
          same rationale as Task.tsx's own checkbox): a real `disabled`
          checkbox correctly gets the browser's prohibited cursor from
          index.css's `button:disabled { cursor: not-allowed }`, which
          flashed for the ~1s a real mutation round-trip takes and read as
          "you did something wrong." Re-entrancy during that window is
          guarded in toggleItem itself instead (see its own comment) — the
          write is exactly as protected against a duplicate, just never
          surfaced to the DOM as a disabled control. */}
      <Checkbox checked={isDone} onCheckedChange={onToggle} />
      <div className="flex flex-col min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={`text-sm ${isDone ? "line-through text-muted-foreground" : ""}`}
          >
            {item.label}
          </span>
          {isContract && item.status === "sent" && (
            <Badge variant="outline">
              {translate("resources.enrollments.contract_sent", {
                _: "Sent",
              })}
            </Badge>
          )}
        </div>
        {!item.is_required && (
          <span className="text-xs text-muted-foreground">
            {translate("resources.enrollments.optional", { _: "Optional" })}
          </span>
        )}
        {!isDone && linkedTask && (
          <span className="text-xs text-muted-foreground">
            {linkedTask.text}
          </span>
        )}
      </div>
      {isContract && item.status === "pending" && (
        <Button
          size="sm"
          variant="ghost"
          disabled={disabled}
          onClick={onMarkSent}
        >
          {translate("resources.enrollments.mark_sent", { _: "Mark sent" })}
        </Button>
      )}
    </div>
  );
};

// Client + Session Operations, ClientShow UX correction: answers "what is
// happening with this client right now?" — a compact summary, an
// Attention section that appears ONLY when something needs Leif's
// judgment, the current period's weeks in plain language, and the full
// multi-month history collapsed behind a disclosure. Replaces the
// earlier, too-ledger-like version (human acceptance: an LE client can
// have ~12 sessions across four months — Leif should never have to scan
// all of them during normal operation). Cadence correction: a booked
// session is assumed attended BY DEFAULT — there is no "Mark Completed"
// step. The only manual action is the reversible negative exception,
// No-show — see markClientSessionNoShow.ts / reverseClientSessionNoShow.ts.
const SessionsCard = ({
  enrollment,
  offer,
}: {
  enrollment: Enrollment;
  offer: Offer;
}) => {
  const translate = useTranslate();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [pendingSessionId, setPendingSessionId] = useState<
    ClientSession["id"] | null
  >(null);
  // Resolution UX correction: the Resolve modal opens as LOCAL state,
  // never a navigation — Leif stays on this exact page/scroll position
  // throughout. null means closed.
  const [openCadenceIssueId, setOpenCadenceIssueId] =
    useState<Identifier | null>(null);

  const cadence = useClientSessionCadence(enrollment.id, true);

  // Same re-entrancy-guard-in-handler shape as the onboarding checklist's
  // own toggleItem (human-acceptance repair, round 4) — never passes
  // `disabled` to a control, so it never earns the browser's prohibited
  // cursor during its own ~1s mutation; a click on the SAME session while
  // its write is in flight is just a safe no-op.
  const handleNoShow = async (session: ClientSession) => {
    if (pendingSessionId === session.id) return;
    setPendingSessionId(session.id);
    try {
      const result = await markClientSessionNoShow(dataProvider, session.id);
      if (result.status === "not-yet-occurred") {
        notify("resources.enrollments.sessions.not_yet_occurred", {
          type: "warning",
          _: "This session hasn't happened yet.",
        });
      } else if (result.status === "cancelled-session") {
        notify("resources.enrollments.sessions.cancelled_session", {
          type: "warning",
          _: "This session was cancelled — showing the current state.",
        });
      }
    } catch {
      notify("ra.notification.http_error", { type: "error" });
    } finally {
      setPendingSessionId(null);
      refresh();
    }
  };

  const handleReverseNoShow = async (session: ClientSession) => {
    if (pendingSessionId === session.id) return;
    setPendingSessionId(session.id);
    try {
      await reverseClientSessionNoShow(dataProvider, session.id);
    } catch {
      notify("ra.notification.http_error", { type: "error" });
    } finally {
      setPendingSessionId(null);
      refresh();
    }
  };

  if (cadence.isPending) return null;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-medium text-muted-foreground">
          {translate("resources.enrollments.sessions.title", {
            _: "Sessions",
          })}
        </h3>
        <p className="text-xs text-muted-foreground">
          {translate("resources.enrollments.sessions.orientation", {
            _: "A booked session counts by default — no need to mark anything, unless something didn't happen as planned.",
          })}
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-1">
          {cadence.currentServicePeriod != null ? (
            <span className="text-lg font-semibold">
              {translate(
                "resources.enrollments.sessions.sessions_this_period",
                {
                  _: "%{fulfilled} of %{expected} sessions this period",
                  fulfilled: cadence.fulfilledCount,
                  expected: cadence.expectedCount,
                },
              )}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">
              {translate("resources.enrollments.sessions.no_start_date", {
                _: "No expected sessions assigned yet.",
              })}
            </span>
          )}
          <span className="text-sm text-muted-foreground">
            {cadence.nextSession
              ? translate("resources.enrollments.sessions.next_at", {
                  _: "Next: %{when}",
                  when: formatTimestampWithTimeString(
                    cadence.nextSession.scheduled_at,
                  ),
                })
              : translate("resources.enrollments.sessions.no_session_booked", {
                  _: "No session booked",
                })}
          </span>
        </CardContent>
      </Card>

      {cadence.attentionItems.length > 0 && (
        <Card className="border-destructive/40">
          <CardContent className="flex flex-col gap-1">
            <span className="text-xs font-medium text-destructive tracking-wide">
              {translate("resources.enrollments.sessions.needs_attention", {
                _: "Needs attention",
              })}
            </span>
            <div className="flex flex-col divide-y">
              {cadence.attentionItems.map((item) => (
                <AttentionRow
                  key={item.slot.id}
                  item={item}
                  sessions={cadence.sessions}
                  onResolve={() => setOpenCadenceIssueId(item.issue!.id)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {cadence.expectedWeeks.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground tracking-wide">
              {translate("resources.enrollments.sessions.current_period", {
                _: "Current Service Period",
              })}
            </span>
            <div className="flex flex-col divide-y">
              {cadence.expectedWeeks.map((week) => (
                <PeriodRow
                  key={week.slot.id}
                  week={week}
                  onResolve={() => setOpenCadenceIssueId(week.issue!.id)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <details className="group rounded-lg border">
        <summary className="cursor-pointer list-none px-4 py-2.5 text-xs text-muted-foreground tracking-wide flex items-center justify-between">
          {translate("resources.enrollments.sessions.history", {
            _: "History",
          })}
          <span className="text-muted-foreground group-open:rotate-180 transition-transform">
            ▾
          </span>
        </summary>
        <div className="flex flex-col divide-y px-4 pb-2.5">
          {cadence.sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2.5">
              {translate("resources.enrollments.sessions.no_sessions_yet", {
                _: "No %{offer} sessions booked yet.",
                offer: offer.name,
              })}
            </p>
          ) : (
            cadence.sessions.map((session) => (
              <ClientSessionRow
                key={session.id}
                session={session}
                onNoShow={() => handleNoShow(session)}
                onReverseNoShow={() => handleReverseNoShow(session)}
              />
            ))
          )}
        </div>
      </details>

      <CadenceResolutionModal
        cadenceIssueId={openCadenceIssueId}
        onOpenChange={(open) => {
          if (!open) setOpenCadenceIssueId(null);
        }}
        onChange={refresh}
      />
    </div>
  );
};

// Human-facing per-window language (UX correction) — deliberately never
// the internal status vocabulary ("Fulfilled"/"Pending"/"Unresolved"):
// Leif thinks in sessions and plain outcomes, not calendar-window
// database states.
const periodRowLabel = (
  week: ExpectedWeekSummary,
  translate: ReturnType<typeof useTranslate>,
): string => {
  switch (week.status) {
    case "fulfilled":
      return translate("resources.enrollments.sessions.session_on", {
        _: "Session %{date}",
        date: formatMonthDayString(
          week.fulfillingSession!.scheduled_at.slice(0, 10),
        ),
      });
    case "pending":
      return translate("resources.enrollments.sessions.upcoming", {
        _: "Upcoming",
      });
    case "unresolved":
      return translate("resources.enrollments.sessions.no_session_booked", {
        _: "No session booked",
      });
    case "known_skip":
      return translate(
        "resources.enrollments.sessions.cadence_status.known_skip",
        {
          _: "Known skip",
        },
      );
    case "rescheduled":
      return translate(
        "resources.enrollments.sessions.cadence_status.rescheduled",
        { _: "Rescheduled" },
      );
    case "missed_ghosted":
      return translate(
        "resources.enrollments.sessions.cadence_status.missed_ghosted",
        { _: "Missed / ghosted" },
      );
  }
};

const CLASSIFIED_STATUSES = new Set([
  "known_skip",
  "rescheduled",
  "missed_ghosted",
]);

const PeriodRow = ({
  week,
  onResolve,
}: {
  week: ExpectedWeekSummary;
  onResolve: () => void;
}) => {
  const translate = useTranslate();
  // A week already classified has no Attention row anymore to reopen it
  // from — this is its own path back into the same modal, so a
  // classification made by mistake is always correctable, not just
  // during the brief window before it's resolved.
  const canEdit = CLASSIFIED_STATUSES.has(week.status) && week.issue != null;

  return (
    <div className="flex items-center gap-3 py-2 first:pt-0 last:pb-0 text-sm">
      <span className="text-muted-foreground w-28 shrink-0">
        {formatWindowWeekLabel(week.slot)}
      </span>
      <span
        className={
          week.status === "pending" ? "text-muted-foreground" : undefined
        }
      >
        {periodRowLabel(week, translate)}
      </span>
      {canEdit && (
        <button
          type="button"
          onClick={onResolve}
          className="text-xs text-muted-foreground underline hover:no-underline ml-auto shrink-0"
        >
          {translate("resources.enrollments.sessions.resolve", {
            _: "Resolve",
          })}
        </button>
      )}
    </div>
  );
};

const AttentionRow = ({
  item,
  sessions,
  onResolve,
}: {
  item: ExpectedWeekSummary;
  sessions: ClientSession[];
  onResolve: () => void;
}) => {
  const translate = useTranslate();
  const noShowSession = findNoShowSessionInSlot(sessions, item.slot);

  return (
    <div className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="flex flex-col min-w-0 flex-1 text-sm">
        <span>
          {formatWindowWeekLabel(item.slot)} ·{" "}
          {noShowSession
            ? translate(
                "resources.enrollments.sessions.session_marked_no_show",
                {
                  _: "%{date} session marked no-show",
                  date: formatMonthDayString(
                    noShowSession.scheduled_at.slice(0, 10),
                  ),
                },
              )
            : translate("resources.enrollments.sessions.no_session_booked", {
                _: "No session booked",
              })}
        </span>
      </div>
      {item.issue && (
        <button
          type="button"
          onClick={onResolve}
          className="text-sm underline hover:no-underline shrink-0"
        >
          {translate("resources.enrollments.sessions.resolve", {
            _: "Resolve",
          })}
        </button>
      )}
    </div>
  );
};

const clientSessionStatusLabels: Record<ClientSession["status"], string> = {
  booked: "Booked",
  cancelled: "Cancelled",
};

const ClientSessionRow = ({
  session,
  onNoShow,
  onReverseNoShow,
}: {
  session: ClientSession;
  onNoShow: () => void;
  onReverseNoShow: () => void;
}) => {
  const translate = useTranslate();
  const isPast = new Date(session.scheduled_at) <= new Date();
  const canMarkNoShow =
    session.status === "booked" && isPast && !session.no_show_at;
  const canReverseNoShow = !!session.no_show_at;

  return (
    <div className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-sm">
          {formatTimestampWithTimeString(session.scheduled_at)}
        </span>
        <span className="text-xs text-muted-foreground">
          {session.no_show_at
            ? translate("resources.enrollments.sessions.no_show", {
                _: "No-show",
              })
            : translate(
                `resources.enrollments.sessions.status.${session.status}`,
                { _: clientSessionStatusLabels[session.status] },
              )}
          {session.reschedule_count > 0 &&
            ` · ${translate("resources.enrollments.sessions.rescheduled", {
              _: "Rescheduled",
            })}`}
        </span>
      </div>
      {/* No `disabled` here on purpose — same rationale as the onboarding
          checklist's own checkbox (human-acceptance repair, round 4):
          re-entrancy during the ~1s mutation is already guarded in the
          handler above (pendingSessionId check), so this never needs to
          earn index.css's `button:disabled { cursor: not-allowed }` for a
          perfectly normal click. */}
      {canMarkNoShow && (
        <Button size="sm" variant="outline" onClick={onNoShow}>
          {translate("resources.enrollments.sessions.mark_no_show", {
            _: "No-show",
          })}
        </Button>
      )}
      {canReverseNoShow && (
        <Button size="sm" variant="ghost" onClick={onReverseNoShow}>
          {translate("resources.enrollments.sessions.undo_no_show", {
            _: "Undo No-show",
          })}
        </Button>
      )}
    </div>
  );
};
