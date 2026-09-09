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
import { Skeleton } from "@/components/ui/skeleton";

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
  Contact,
  Enrollment,
  EnrollmentOffboardingItem,
  EnrollmentOnboardingItem,
  Offer,
} from "../types";
import { AddTask } from "../tasks/AddTask";
import { TasksListByDueDate } from "../tasks/TasksListByDueDate";
import { activateEnrollment } from "./activateEnrollment";
import { completeClient } from "./completeClient";
import { completeOffboardingItem } from "./completeOffboardingItem";
import { completeOnboardingItem } from "./completeOnboardingItem";
import { computeOffboardingProgress } from "./computeOffboardingProgress";
import type { OffboardingProgress } from "./computeOffboardingProgress";
import { computeOnboardingProgress } from "./computeOnboardingProgress";
import type { OnboardingProgress } from "./computeOnboardingProgress";
import { enrollmentStatusLabels } from "./enrollmentConstants";
import { reopenOffboardingItem } from "./reopenOffboardingItem";
import { reopenOnboardingItem } from "./reopenOnboardingItem";
import { startOffboarding } from "./startOffboarding";
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
  const {
    isPending,
    deal,
    contact,
    offer,
    cohort,
    items,
    offboardingItems,
    tasks,
  } = useEnrollmentOperationalData(enrollment);

  if (isPending || !enrollment || !deal || !offer) return null;

  const contactName = contact
    ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim()
    : deal.name;

  const onboardingProgress = computeOnboardingProgress(items);
  // ClientShow onboarding-hierarchy repair: collapse the checklist below
  // Sessions ONLY once the Enrollment has actually moved past the
  // onboarding phase (status !== "onboarding") — not the instant the
  // checklist alone reaches 4/4. The split-second "all required items
  // done, still status=onboarding" moment is exactly when the
  // pre-existing Activate button appears (readyToActivate, below) —
  // this repair's own instruction says those actions stay "operationally
  // important... during onboarding", so the checklist stays expanded
  // near the top through the whole onboarding phase, the activation
  // click included. Completion itself still comes ONLY from the
  // checklist's own data (never inferred from status) — status only
  // decides WHEN a genuinely-complete checklist is safe to tuck away.
  const onboardingCollapsed =
    onboardingProgress.allRequiredComplete &&
    enrollment.status !== "onboarding";

  // Client Offboarding slice: the offboarding checklist only ever has
  // rows once offboarding has genuinely started (nothing is snapshotted
  // before then) — expanded and prominent while status is "offboarding"
  // itself (§6: "prominent enough to understand that the client is
  // winding down"), collapsed alongside onboarding once truly
  // "completed" (§9), same lifecycle-aware pattern as onboarding above.
  const offboardingProgress = computeOffboardingProgress(offboardingItems);
  const showOffboarding = offboardingItems.length > 0;
  // Human-acceptance repair, offboarding hierarchy: while status is
  // literally "offboarding", it's the primary lifecycle action Leif is
  // performing on this client right now — it renders expanded, right
  // after Payment, the same "operationally important, near the top"
  // treatment onboarding gets during ITS own active phase (see
  // onboardingCollapsed's own comment). Once truly "completed", it moves
  // to the secondary/historical position below Sessions instead — never
  // both at once (showOffboardingProminent and showOffboardingSecondary
  // are mutually exclusive), so the checklist is never rendered twice.
  const showOffboardingProminent =
    enrollment.status === "offboarding" && showOffboarding;
  const showOffboardingSecondary = showOffboarding && !showOffboardingProminent;

  // Client + Session Operations slice A, extended by the Client
  // Offboarding slice (§6/§9): Sessions/History stays visible through
  // offboarding (historical session context is exactly what §6 asks for)
  // and completed (§9's own "Sessions / History" line) — only "onboarding"
  // never shows it, since no cadence exists yet at that stage. Still
  // gated on the Offer actually having paid-client-session tracking
  // configured (currently only The Living Example) — GYU never shows
  // this section regardless of lifecycle stage.
  const showSessions =
    enrollment.status !== "onboarding" &&
    offer.client_session_acuity_appointment_type_id != null;

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
        {/* Manual Task UX repair: lets Leif jot a follow-up ("Check in
            about GYU attendance", "Ask about scheduling") right from this
            Client's own page — no navigating to their Contact page first.
            ClientShow's own record context is the Enrollment, not the
            Contact (verified above), so the resolved `contact` is passed
            explicitly rather than letting AddTask read the wrong id off
            context. Guarded on `contact` existing, same as the Avatar
            above — a Deal without a linked Contact has no valid
            contact_id for a Task to point at. */}
        <div className="ml-auto flex items-center gap-1">
          {contact && <AddTask display="icon" contact={contact} />}
          {/* Client Offboarding slice (§5): a consequential lifecycle
              change, so it's a clear, explicit human action — never
              inferred from dates or session counts. Only ever shown for
              an ACTIVE Enrollment; StartOffboardingButton itself re-checks
              this server-side too (see startOffboarding.ts). */}
          {enrollment.status === "active" && (
            <StartOffboardingButton enrollmentId={enrollment.id} />
          )}
          <Badge
            variant={
              enrollment.status === "completed" ? "secondary" : "outline"
            }
          >
            {enrollmentStatusLabels[enrollment.status]}
          </Badge>
        </div>
      </div>

      <PaymentContextCard deal={deal} currency={currency} />

      {/* Human-acceptance repair, offboarding hierarchy: while status is
          "offboarding" itself, this IS the primary lifecycle action —
          expanded, right after Payment, before Tasks/Sessions — see
          showOffboardingProminent's own comment above. */}
      {showOffboardingProminent && (
        <OffboardingChecklistCard
          enrollment={enrollment}
          tasks={tasks}
          progress={offboardingProgress}
          collapsed={false}
        />
      )}

      {/* ClientShow onboarding-hierarchy repair: while onboarding still
          needs Leif's attention, the checklist stays expanded up here —
          see onboardingCollapsed's own comment above. */}
      {!onboardingCollapsed && (
        <OnboardingChecklistCard
          enrollment={enrollment}
          tasks={tasks}
          progress={onboardingProgress}
          collapsed={false}
        />
      )}

      {/* Manual Task UX repair, round 2 (§1): the Client page is the
          operational home once someone has a current Enrollment — Leif
          shouldn't have to bounce to ContactShow to see this person's
          Tasks. Guarded on `contact` existing, same reasoning as the
          header's own AddTask above (a Deal without a linked Contact has
          no contact_id for a Task query either). */}
      {contact && <TasksCard contact={contact} />}

      {/* Client + Session Operations slice A, extended by the Client
          Offboarding slice: see showSessions's own comment above for why
          offboarding/completed now show this section too — only
          onboarding and a non-session-tracked Offer (e.g. GYU) don't. */}
      {showSessions && <SessionsCard enrollment={enrollment} offer={offer} />}

      {/* ClientShow onboarding-hierarchy repair: once onboarding is done
          and behind the client, the completed checklist moves down here,
          collapsed by default — see onboardingCollapsed's own comment
          above. */}
      {onboardingCollapsed && (
        <OnboardingChecklistCard
          enrollment={enrollment}
          tasks={tasks}
          progress={onboardingProgress}
          collapsed={true}
        />
      )}

      {/* Human-acceptance repair, offboarding hierarchy: the secondary/
          historical position — always collapsed here (the ONLY expanded
          rendering is the prominent block above, for status
          "offboarding" itself). Reached by status "completed" (matching
          §9's "Onboarding ... / Offboarding ..." order) or the rare
          backward-corrected "active with existing offboarding items"
          edge case — same collapsed-history treatment either way. Never
          rendered alongside the prominent block — see
          showOffboardingSecondary's own comment. */}
      {showOffboardingSecondary && (
        <OffboardingChecklistCard
          enrollment={enrollment}
          tasks={tasks}
          progress={offboardingProgress}
          collapsed={true}
        />
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
  tasks,
  progress,
  collapsed,
}: {
  enrollment: Enrollment;
  tasks: ReturnType<typeof useEnrollmentOperationalData>["tasks"];
  progress: OnboardingProgress;
  // ClientShow onboarding-hierarchy repair: decided once by the parent
  // (which position — near-top vs. after Sessions — it's rendering this
  // component at), never re-derived here from progress alone. Re-
  // deriving "complete -> collapsed" locally would collapse the
  // checklist the instant the LAST required item is checked even while
  // Enrollment.status is still "onboarding" — exactly the moment the
  // Activate button below needs to stay visible.
  collapsed: boolean;
}) => {
  const translate = useTranslate();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [pendingItemId, setPendingItemId] = useState<
    EnrollmentOnboardingItem["id"] | null
  >(null);
  const [activating, setActivating] = useState(false);

  const { requiredItems, optionalItems, requiredDoneCount } = progress;
  const readyToActivate =
    enrollment.status === "onboarding" && progress.allRequiredComplete;

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

  const checklist = (
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
  );

  // ClientShow onboarding-hierarchy repair: once onboarding is done and
  // behind the client, the checklist is historical record, not an
  // operational surface — collapsed by default behind the SAME <details>
  // disclosure convention SessionsCard's own History already uses,
  // rather than inventing a new interaction. Never deleted: expanding it
  // still shows every item exactly as before.
  if (collapsed) {
    return (
      <details className="group rounded-lg border">
        <summary className="cursor-pointer list-none px-4 py-2.5 text-xs text-muted-foreground tracking-wide flex items-center justify-between">
          {translate("resources.enrollments.onboarding_collapsed_summary", {
            _: "Onboarding · Complete %{done}/%{total}",
            done: requiredDoneCount,
            total: requiredItems.length,
          })}
          <span className="text-muted-foreground group-open:rotate-180 transition-transform">
            ▾
          </span>
        </summary>
        <div className="px-4 pb-2.5 pt-1">{checklist}</div>
      </details>
    );
  }

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
      {checklist}
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

// Client Offboarding slice (§5): the explicit human "Start offboarding"
// action. Mirrors the Activate button's own re-entrancy-guard shape
// (Human-acceptance repair, round 4) — never passed `disabled` during
// its own mutation window, since startOffboarding.ts already re-fetches
// fresh state and safely no-ops on a duplicate click.
const StartOffboardingButton = ({
  enrollmentId,
}: {
  enrollmentId: Enrollment["id"];
}) => {
  const translate = useTranslate();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [pending, setPending] = useState(false);

  const handleClick = async () => {
    if (pending) return;
    setPending(true);
    try {
      const result = await startOffboarding(dataProvider, enrollmentId);
      if (!result.applied) {
        notify("resources.enrollments.not_active", {
          type: "warning",
          _: "This client is no longer active — showing the current state.",
        });
      } else {
        notify("resources.enrollments.offboarding_started", {
          type: "info",
          _: "Offboarding started.",
        });
      }
    } catch {
      notify("ra.notification.http_error", { type: "error" });
    } finally {
      setPending(false);
      refresh();
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={handleClick}>
      {translate("resources.enrollments.start_offboarding", {
        _: "Start offboarding",
      })}
    </Button>
  );
};

// Client Offboarding slice: the offboarding mirror of
// OnboardingChecklistCard — same collapsed/expanded <details> pattern
// (decided by the parent, never re-derived here — see
// OnboardingChecklistCard's own `collapsed` comment for why), same
// checklist-row shape. Simpler than onboarding's own header: no
// "readyToActivate" transient distinction (Complete client only ever
// shows while status is literally "offboarding", which is also the only
// status this ever renders expanded for — there's no equivalent
// "already moved past this stage but not yet clicked" moment the way
// onboarding's Activate button has, since nothing else needs to happen
// between requirements-complete and clicking Complete client).
const OffboardingChecklistCard = ({
  enrollment,
  tasks,
  progress,
  collapsed,
}: {
  enrollment: Enrollment;
  tasks: ReturnType<typeof useEnrollmentOperationalData>["tasks"];
  progress: OffboardingProgress;
  collapsed: boolean;
}) => {
  const translate = useTranslate();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [pendingItemId, setPendingItemId] = useState<
    EnrollmentOffboardingItem["id"] | null
  >(null);
  const [completing, setCompleting] = useState(false);

  const { requiredItems, optionalItems, requiredDoneCount } = progress;
  const readyToComplete =
    enrollment.status === "offboarding" && progress.allRequiredComplete;

  const toggleItem = async (item: EnrollmentOffboardingItem) => {
    if (pendingItemId === item.id) return;
    setPendingItemId(item.id);
    try {
      if (item.status === "done") {
        await reopenOffboardingItem(dataProvider, item.id);
      } else {
        await completeOffboardingItem(dataProvider, item.id);
      }
    } catch {
      notify("ra.notification.http_error", { type: "error" });
    } finally {
      setPendingItemId(null);
      refresh();
    }
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      const result = await completeClient(dataProvider, enrollment.id);
      if (!result.applied) {
        notify(
          result.reason === "not-offboarding"
            ? "resources.enrollments.already_completed"
            : "resources.enrollments.completion_incomplete",
          {
            type: "warning",
            _:
              result.reason === "not-offboarding"
                ? "This client is no longer awaiting offboarding — showing the current state."
                : "Some required items are still incomplete — showing the current state.",
          },
        );
      } else {
        notify("resources.enrollments.completed", {
          type: "info",
          _: "Offboarding complete",
        });
      }
    } catch {
      notify("ra.notification.http_error", { type: "error" });
    } finally {
      setCompleting(false);
      refresh();
    }
  };

  const checklist = (
    <Card>
      <CardContent className="flex flex-col divide-y">
        {[...requiredItems, ...optionalItems].map((item) => (
          <OffboardingItemRow
            key={item.id}
            item={item}
            tasks={tasks}
            onToggle={() => toggleItem(item)}
          />
        ))}
      </CardContent>
    </Card>
  );

  if (collapsed) {
    return (
      <details className="group rounded-lg border">
        <summary className="cursor-pointer list-none px-4 py-2.5 text-xs text-muted-foreground tracking-wide flex items-center justify-between">
          {translate("resources.enrollments.offboarding_collapsed_summary", {
            _: "Offboarding · Complete %{done}/%{total}",
            done: requiredDoneCount,
            total: requiredItems.length,
          })}
          <span className="text-muted-foreground group-open:rotate-180 transition-transform">
            ▾
          </span>
        </summary>
        <div className="px-4 pb-2.5 pt-1">{checklist}</div>
      </details>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          {translate("resources.enrollments.offboarding_checklist", {
            _: "Offboarding",
          })}
          {requiredItems.length > 0 &&
            ` ${requiredDoneCount}/${requiredItems.length}`}
        </h3>
        {readyToComplete && (
          <Button size="sm" disabled={completing} onClick={handleComplete}>
            {completing
              ? translate("resources.enrollments.completing", {
                  _: "Completing…",
                })
              : translate("resources.enrollments.complete_client", {
                  _: "Complete client",
                })}
          </Button>
        )}
      </div>
      {checklist}
    </div>
  );
};

// No `disabled` prop here on purpose — unlike OnboardingItemRow, no row
// in this checklist has a second control (like "Mark sent") that would
// ever need it; the checkbox itself is already never disabled, same
// re-entrancy-guarded-in-handler rationale.
const OffboardingItemRow = ({
  item,
  tasks,
  onToggle,
}: {
  item: EnrollmentOffboardingItem;
  tasks: ReturnType<typeof useEnrollmentOperationalData>["tasks"];
  onToggle: () => void;
}) => {
  const translate = useTranslate();
  const isDone = item.status === "done";
  const linkedTask = tasks.find(
    (task) => task.offboarding_item_id === item.id && !task.done_date,
  );

  return (
    <div className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      {/* No `disabled` here on purpose — same rationale as
          OnboardingItemRow's own checkbox above. */}
      <Checkbox checked={isDone} onCheckedChange={onToggle} />
      <div className="flex flex-col min-w-0 flex-1">
        <span
          className={`text-sm ${isDone ? "line-through text-muted-foreground" : ""}`}
        >
          {item.label}
        </span>
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
    </div>
  );
};

// Manual Task UX repair, round 2 (§1): the Client page's own Tasks
// section — the SAME TasksListByDueDate/AddTask machinery
// ContactShow's own tab already uses (ContactTasksList.tsx), filtered by
// this Contact directly (never enrollment_id — a Contact's operational
// Tasks span more than one Enrollment's own onboarding checklist, e.g. a
// manual "Check in about GYU attendance" Task or a payment follow-up).
// Deliberately does NOT render a second AddTask chip here — the header
// above already has one (contact explicitly passed there too, for the
// same reason). TasksListByDueDate itself already keeps this calm with
// many historical Tasks: only pending (and briefly recently-completed)
// Tasks ever render here — completed history simply isn't shown, the
// same established behavior ContactShow's own Tasks tab already relies
// on, not a new pattern invented for this page.
const TasksCard = ({ contact }: { contact: Contact }) => {
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-medium text-muted-foreground">
        {translate("resources.tasks.name", { smart_count: 2 })}
      </h3>
      <Card>
        <CardContent>
          <TasksListByDueDate
            filterByContact={contact.id}
            emptyPlaceholder={
              <p className="text-sm text-muted-foreground text-center py-2">
                {translate("resources.tasks.empty")}
              </p>
            }
            pendingPlaceholder={
              <div className="flex flex-col gap-4">
                {Array.from({ length: 2 }).map((_, index) => (
                  <Skeleton className="w-full h-10" key={index} />
                ))}
              </div>
            }
          />
        </CardContent>
      </Card>
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
