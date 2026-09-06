import { useCallback, useEffect, useState } from "react";
import { useDataProvider, useNotify, useTranslate } from "ra-core";
import { Link, useParams } from "react-router";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

import { formatTimestampWithTimeString } from "../deals/dealUtils";
import type { Deal } from "../types";
import type { SalesCallResolutionContext } from "./loadSalesCallResolutionContext";
import { loadSalesCallResolutionContext } from "./loadSalesCallResolutionContext";
import {
  attachSalesCallToOpportunity,
  createOpportunityAndAttachSalesCall,
  dismissSalesCall,
} from "./resolveUnmatchedSalesCall";

// Unmatched Sales Call Resolution slice: the dedicated resolution UI a
// resolve_sales_call Task now routes to (taskActionDestination.ts /
// useTaskActionDestination.ts), replacing the generic Task editor — which
// exposed Description/Due date/Type/Status, none of which answer the
// actual question: "what Opportunity does this Acuity booking belong to?"
export const ResolveSalesCallPage = () => {
  const { id } = useParams();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const translate = useTranslate();
  const [context, setContext] = useState<
    SalesCallResolutionContext | "pending"
  >("pending");
  const [busy, setBusy] = useState(false);
  const [dismissReason, setDismissReason] = useState("");
  const [showDismissForm, setShowDismissForm] = useState(false);
  // Human-acceptance repair: distinguishes "I just did this" from "I'm
  // revisiting an already-resolved booking later" — the smallest reliable
  // mechanism available, since this page's whole lifecycle is one mount
  // (load once, act once, done, per loadSalesCallResolutionContext.ts's own
  // comment). A genuine revisit (direct URL, back/forward, a fresh tab)
  // always remounts the component, resetting this to false on its own —
  // never persisted, so it can never falsely replay a success state.
  const [justResolved, setJustResolved] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setContext({ kind: "not-found" });
      return;
    }
    const result = await loadSalesCallResolutionContext(dataProvider, id);
    setContext(result);
  }, [dataProvider, id]);

  useEffect(() => {
    load();
  }, [load]);

  if (context === "pending") return null;

  if (context.kind === "not-found") {
    return (
      <PageShell
        title={translate("resources.sales_calls.resolve.title", {
          _: "Sales call needs matching",
        })}
      >
        <p className="text-sm text-muted-foreground">
          {translate("resources.sales_calls.resolve.not_found", {
            _: "This booking no longer exists.",
          })}
        </p>
      </PageShell>
    );
  }

  const { contact, salesCall } = context;
  const contactName =
    `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim();

  const handleAttach = async (opportunityId: Deal["id"]) => {
    setBusy(true);
    try {
      const result = await attachSalesCallToOpportunity(dataProvider, {
        salesCallId: salesCall.id,
        opportunityId,
      });
      if (!result.applied) {
        notify(resolveErrorMessage(result.reason), { type: "warning" });
        await load();
      } else {
        setJustResolved(true);
        notify("resources.sales_calls.resolve.attached", {
          type: "info",
          _: "Attached to the Opportunity.",
        });
        await load();
      }
    } catch {
      notify("ra.notification.http_error", { type: "error" });
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async () => {
    setBusy(true);
    try {
      const result = await createOpportunityAndAttachSalesCall(dataProvider, {
        salesCallId: salesCall.id,
      });
      if (!result.applied) {
        notify(resolveErrorMessage(result.reason), { type: "warning" });
        await load();
      } else {
        setJustResolved(true);
        notify("resources.sales_calls.resolve.created", {
          type: "info",
          _: "Opportunity created.",
        });
        await load();
      }
    } catch {
      notify("ra.notification.http_error", { type: "error" });
    } finally {
      setBusy(false);
    }
  };

  const handleDismiss = async () => {
    setBusy(true);
    try {
      const result = await dismissSalesCall(dataProvider, {
        salesCallId: salesCall.id,
        reason: dismissReason,
      });
      if (!result.applied) {
        notify(resolveErrorMessage(result.reason), { type: "warning" });
      }
      await load();
    } catch {
      notify("ra.notification.http_error", { type: "error" });
    } finally {
      setBusy(false);
    }
  };

  if (context.kind === "already-resolved") {
    // Immediate post-action acknowledgment, distinct from a later plain
    // revisit: Leif just attached/created this Opportunity himself in this
    // same page load — say so, rather than the flatly-true-but-cold "this
    // booking is already attached" line a fresh visit would show.
    if (justResolved && context.opportunity) {
      const opportunity = context.opportunity;
      return (
        <PageShell
          title={translate("resources.sales_calls.resolve.title", {
            _: "Sales call needs matching",
          })}
        >
          <Card>
            <CardContent className="flex flex-col gap-2">
              <p className="text-sm font-medium">
                {translate("resources.sales_calls.resolve.attached_success", {
                  _: "Sales call attached ✓",
                })}
              </p>
              <p className="text-sm text-muted-foreground">
                {contactName}
                {opportunity.offer_name_snapshot
                  ? ` · ${opportunity.offer_name_snapshot}`
                  : ""}
              </p>
              <Link
                to={`/deals/${opportunity.id}/show`}
                className="text-sm underline hover:no-underline"
              >
                {translate("resources.sales_calls.resolve.view_opportunity", {
                  _: "View the Opportunity",
                })}
              </Link>
            </CardContent>
          </Card>
        </PageShell>
      );
    }

    return (
      <PageShell
        title={translate("resources.sales_calls.resolve.title", {
          _: "Sales call needs matching",
        })}
      >
        <Card>
          <CardContent className="flex flex-col gap-2">
            <p className="text-sm">
              {salesCall.dismissed_at
                ? translate("resources.sales_calls.resolve.was_dismissed", {
                    _: "This booking was dismissed — it was never a sales situation.",
                  })
                : translate("resources.sales_calls.resolve.was_attached", {
                    _: "This booking is already attached to an Opportunity.",
                  })}
            </p>
            {context.opportunity && (
              <Link
                to={`/deals/${context.opportunity.id}/show`}
                className="text-sm underline hover:no-underline"
              >
                {translate("resources.sales_calls.resolve.view_opportunity", {
                  _: "View the Opportunity",
                })}
              </Link>
            )}
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={translate("resources.sales_calls.resolve.title", {
        _: "Sales call needs matching",
      })}
    >
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-base font-semibold">
              <Link
                to={`/contacts/${contact.id}/show`}
                className="hover:underline"
              >
                {contactName}
              </Link>
              {context.kind === "resolvable" &&
                ` · ${context.offer.name}${context.cohort ? ` — ${context.cohort.name}` : ""}`}
            </span>
            <span className="text-sm text-muted-foreground">
              {formatTimestampWithTimeString(salesCall.scheduled_at)}
            </span>
          </div>

          {/* Human-acceptance repair, round 3: "couldn't be matched, tell
              the CRM where it belongs" answered nothing about WHY — Leif
              shouldn't need to understand the matching algorithm to know
              what he's looking at. The CRM already knows the specific
              reason (zero candidates vs. more than one vs. an unmapped
              appointment type — the only three unresolved shapes
              matchAcuityBooking.ts's own findActiveOpportunityMatch /
              resolveOfferCohortForAppointmentType can actually produce),
              so it says so explicitly instead of a single generic line. */}
          {context.kind === "resolvable" && (
            <div className="flex flex-col gap-1">
              {context.compatibleOpportunities.length === 0 ? (
                <>
                  <span className="text-sm font-semibold">
                    {translate("resources.sales_calls.resolve.no_match_title", {
                      _: "No %{offer} opportunity found",
                      offer: context.offer.name,
                    })}
                  </span>
                  <p className="text-sm text-muted-foreground">
                    {translate(
                      "resources.sales_calls.resolve.no_match_explanation",
                      {
                        _: "%{name} booked a %{offer} sales call, but they don't have an open %{offer} opportunity in the CRM.",
                        name: contactName,
                        offer: context.offer.name,
                      },
                    )}
                  </p>
                </>
              ) : (
                <>
                  <span className="text-sm font-semibold">
                    {context.compatibleOpportunities.length === 1
                      ? translate(
                          "resources.sales_calls.resolve.match_found_title",
                          { _: "A matching opportunity was found" },
                        )
                      : translate(
                          "resources.sales_calls.resolve.ambiguous_title",
                          {
                            _: "More than one opportunity could match this call",
                          },
                        )}
                  </span>
                  <p className="text-sm text-muted-foreground">
                    {translate(
                      "resources.sales_calls.resolve.choose_explanation",
                      {
                        _: "%{name} booked a %{offer} sales call. Choose the opportunity this call belongs to.",
                        name: contactName,
                        offer: context.offer.name,
                      },
                    )}
                  </p>
                </>
              )}
            </div>
          )}

          {context.kind === "unknown-appointment-type" && (
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold">
                {translate("resources.sales_calls.resolve.unknown_type_title", {
                  _: "Appointment type not mapped to an Offer",
                })}
              </span>
              <p className="text-sm text-muted-foreground">
                {translate("resources.sales_calls.resolve.unknown_type", {
                  _: "This booking's appointment type isn't mapped to an Offer yet — only Dismiss is available.",
                })}
              </p>
            </div>
          )}

          {context.kind === "resolvable" &&
            context.compatibleOpportunities.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-xs text-muted-foreground tracking-wide">
                  {translate("resources.sales_calls.resolve.attach_heading", {
                    _: "Attach to an existing Opportunity",
                  })}
                </span>
                {context.compatibleOpportunities.map((opportunity) => (
                  <div
                    key={opportunity.id}
                    className="flex items-center justify-between gap-2 rounded-lg border p-3"
                  >
                    <span className="text-sm">{opportunity.name}</span>
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => handleAttach(opportunity.id)}
                    >
                      {translate("resources.sales_calls.resolve.attach", {
                        _: "Attach",
                      })}
                    </Button>
                  </div>
                ))}
              </div>
            )}

          {/* Only offered when nothing compatible already exists — once a
              compatible Opportunity is on record (one or several), Create
              would just manufacture ambiguity next to it rather than
              resolve any. */}
          {context.kind === "resolvable" &&
            context.compatibleOpportunities.length === 0 && (
              <Button disabled={busy} onClick={handleCreate}>
                {translate("resources.sales_calls.resolve.create", {
                  _: "Create %{offer} opportunity",
                  offer: context.offer.name,
                })}
              </Button>
            )}

          <div className="border-t pt-3 flex flex-col gap-2">
            {!showDismissForm ? (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => setShowDismissForm(true)}
              >
                {translate("resources.sales_calls.resolve.dismiss", {
                  _: "Dismiss booking",
                })}
              </Button>
            ) : (
              <>
                <Textarea
                  placeholder={translate(
                    "resources.sales_calls.resolve.dismiss_reason_placeholder",
                    { _: "Why? (optional) — test booking, mistake, etc." },
                  )}
                  value={dismissReason}
                  onChange={(event) => setDismissReason(event.target.value)}
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setShowDismissForm(false)}
                  >
                    {translate("ra.action.cancel")}
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={busy}
                    onClick={handleDismiss}
                  >
                    {translate("resources.sales_calls.resolve.dismiss", {
                      _: "Dismiss booking",
                    })}
                  </Button>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
};

const PageShell = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="max-w-lg mx-auto mt-8 flex flex-col gap-2">
    <h1 className="text-xl font-semibold">{title}</h1>
    {children}
  </div>
);

const resolveErrorMessage = (
  reason:
    | "already-resolved"
    | "incompatible-opportunity"
    | "unknown-appointment-type",
): string => {
  switch (reason) {
    case "already-resolved":
      return "This booking was already resolved — showing the current state.";
    case "incompatible-opportunity":
      return "That Opportunity doesn't match this booking's offer — showing the current state.";
    default:
      return "This appointment type isn't mapped to an Offer.";
  }
};

ResolveSalesCallPage.path = "/sales-calls/:id/resolve";
