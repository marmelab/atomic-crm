import { createErrorResponse } from "../_shared/utils.ts";
import { corsHeaders } from "../_shared/cors.ts";
import type { StripeReconcileDelta } from "./stripeReconcile.ts";

// "Sync Stripe" for the whole account, asked for from the Dashboard.
//
// The sweep itself already existed and is deliberately hard to reach: it
// walks every Stripe customer, so it authenticates with the cron secret
// and nothing signed in from a browser gets to call it. That boundary is
// correct and is not being widened — putting the secret in the browser, or
// letting any authenticated session call the cron endpoint, would both
// trade a real protection for a button.
//
// So the browser ASKS and the server DECIDES. The caller proves who they
// are with their own Supabase JWT; the server verifies it against Supabase
// Auth, looks their `sales` row up with the service role, and runs the
// sweep only for an administrator who is not disabled. The same boundary
// the user-management function already uses for invites — reused, not
// reinvented.
//
// Three things this deliberately does NOT do:
//
//   * take parameters. There is nothing to steer, so no request can turn
//     it into a tour of the Stripe account.
//   * return Stripe identifiers. The sweep's own delta carries customer
//     ids, candidate ids and raw error strings; the browser gets counts.
//   * touch the cron path. That branch is untouched above this one.

export type OwnerStripeSyncSummary = {
  status: "synced";
  // What a person needs to know: how much was looked at, how much moved,
  // and whether anything wants their attention. No identifiers.
  customersChecked: number;
  updatesApplied: number;
  needsReview: number;
  ambiguous: number;
  errors: number;
};

export type SalesRow = {
  administrator: boolean;
  disabled: boolean;
};

export type OwnerAuthority =
  | { authorized: true }
  | { authorized: false; status: number; message: string };

// Who is allowed to sweep the whole Stripe account.
//
// `administrator` on the caller's own `sales` row, read server-side with
// the service role — never a claim the browser supplies, and never an
// email compared in React. A disabled account is refused even if the flag
// is still set: disabling somebody is supposed to stop them doing things.
export const authorizeOwner = (sale: SalesRow | null): OwnerAuthority => {
  if (!sale) {
    return {
      authorized: false,
      status: 403,
      message: "No CRM account for this user.",
    };
  }
  if (sale.disabled) {
    return { authorized: false, status: 403, message: "Account is disabled." };
  }
  if (!sale.administrator) {
    return { authorized: false, status: 403, message: "Not Authorized" };
  }
  return { authorized: true };
};

// Counts only. The sweep's delta is rich and most of it is nobody's
// business from a browser: needsReview and ambiguous carry Contact ids and
// Stripe customer ids, and `errors` carries whatever Stripe said, which
// can name objects the caller never needed to see.
export const summarizeForOwner = (
  delta: StripeReconcileDelta,
): OwnerStripeSyncSummary => ({
  status: "synced",
  customersChecked: delta.customersScanned,
  updatesApplied:
    delta.schedulesLinked +
    delta.subscriptionsLinked +
    delta.paymentStatesUpdated +
    delta.paymentsIngested +
    delta.paymentsMerged +
    delta.planObjectsRecorded +
    delta.planObjectsUpdated +
    delta.agreedTermsDerived,
  needsReview: delta.needsReview.length,
  ambiguous: delta.ambiguous.length,
  errors: delta.errors.length,
});

// The whole branch, with its three collaborators injected: who the caller
// is (verified by Supabase Auth), what their `sales` row says (read with
// the service role), and the canonical sweep. Written this way so the
// authorization can be PROVEN rather than asserted in a comment — every
// refusal below is a test, and every one of them checks that the sweep
// never ran.
export type OwnerStripeSyncDeps = {
  // Returns the caller only if their JWT really verified. A header the
  // browser merely sent is not a user.
  authenticate: (req: Request) => Promise<{ id: string } | null>;
  loadSale: (userId: string) => Promise<SalesRow | null>;
  reconcile: () => Promise<StripeReconcileDelta>;
};

export const handleOwnerStripeSync = async (
  req: Request,
  deps: OwnerStripeSyncDeps,
): Promise<Response> => {
  let user: { id: string } | null = null;
  try {
    user = await deps.authenticate(req);
  } catch {
    user = null;
  }
  if (!user) {
    return createErrorResponse(401, "Unauthorized");
  }

  const authority = authorizeOwner(await deps.loadSale(user.id));
  if (!authority.authorized) {
    return createErrorResponse(authority.status, authority.message);
  }

  // Note what is NOT read on the way here: no `x-cron-secret` (this door
  // does not take that key, so the cron endpoint was not widened to build
  // it) and nothing at all from the query string or the body (so no
  // request can redirect the sweep at some other part of the Stripe
  // account).
  const delta = await deps.reconcile();
  return new Response(JSON.stringify(summarizeForOwner(delta)), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
    status: 200,
  });
};
