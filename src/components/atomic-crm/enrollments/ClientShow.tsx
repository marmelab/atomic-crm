import { useState } from "react";
import {
  useDataProvider,
  useNotify,
  useRecordContext,
  useRefresh,
  useTranslate,
} from "ra-core";
import { Link } from "react-router";

import { EditButton } from "@/components/admin/edit-button";
import { Show } from "@/components/admin/show";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";

import { Avatar } from "../contacts/Avatar";
import { formatISODateString } from "../deals/dealUtils";
import { formatOfferPageAmount } from "../deals/offerPageMoney";
import { formatRemainingInstallmentsCopy } from "../deals/paymentPlanRemainingCopy";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Enrollment, EnrollmentOnboardingItem } from "../types";
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
