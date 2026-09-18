// Contact identity safety rails.
//
// Audit #6 found that merging one Contact into another repoints exactly
// three tables — tasks, contact_notes, deals — and then DELETEs the loser.
// Every other table that points at a Contact is left to the foreign key,
// and most of those cascade. So a merge silently destroys sales calls,
// client sessions, Stripe identities and waitlist entries, and aborts
// outright when the loser has an Application or a waitlist invitation.
//
// The same cascade sits behind ordinary Contact deletion, which the UI
// offered in three places with nothing but a generic confirm dialog.
//
// Neither operation has ever been used on real data: every historical
// merge was a deliberate SQL migration, which is why live referential
// integrity is clean. Rather than rely on that continuing, both paths are
// closed here until a genuinely transactional merge exists.
//
// This module is the single place that decides. The UI reads it, both
// data providers read it, and the Edge Function mirrors its message.

/**
 * Whether merging one Contact into another is available.
 *
 * Stays false until a merge exists that repoints every dependent table
 * inside one transaction and records what it moved.
 */
export const CONTACT_MERGE_ENABLED = false;

/**
 * Whether deleting a Contact outright is available.
 *
 * Deleting a Contact cascades into deals, sales_calls, client_sessions,
 * contact_notes, contact_stripe_customers, tasks and waitlist_entries —
 * years of business history behind one confirm dialog.
 */
export const CONTACT_DELETE_ENABLED = false;

export const CONTACT_MERGE_DISABLED_MESSAGE =
  "Contact merge is temporarily unavailable while identity safety work is being completed.";

export const CONTACT_DELETE_DISABLED_MESSAGE =
  "Deleting a contact is temporarily unavailable while identity safety work is being completed.";

/** Machine-readable codes, so a caller can tell refusal from failure. */
export const CONTACT_MERGE_DISABLED_CODE = "contact_merge_disabled";
export const CONTACT_DELETE_DISABLED_CODE = "contact_delete_disabled";

/**
 * Refuse a merge before anything is read or written.
 *
 * Both data providers call this first. It throws rather than resolving,
 * so no caller can mistake a refusal for a completed merge.
 */
export const refuseContactMerge = (): never => {
  const error = new Error(CONTACT_MERGE_DISABLED_MESSAGE) as Error & {
    code?: string;
  };
  error.code = CONTACT_MERGE_DISABLED_CODE;
  throw error;
};

/**
 * Refuse a Contact deletion before anything is written.
 *
 * Both data providers call this for the `contacts` resource, so removing
 * the buttons is not the whole of it: any code path that reaches for
 * delete gets the same answer.
 */
export const refuseContactDelete = (): never => {
  const error = new Error(CONTACT_DELETE_DISABLED_MESSAGE) as Error & {
    code?: string;
  };
  error.code = CONTACT_DELETE_DISABLED_CODE;
  throw error;
};

/**
 * What actually happens to each table when a Contact row is deleted.
 *
 * Read from the live database during the Slice 0 audit and frozen here.
 * `contactSafety.test.ts` asserts the repo's SQL still declares exactly
 * this, so a future schema change cannot quietly widen the blast radius
 * or add a new dependent table nobody accounted for.
 */
export type ContactDeleteRule = "CASCADE" | "NO ACTION";

export const CONTACT_FK_DELETE_RULES: Record<string, ContactDeleteRule> = {
  // Destroyed with the Contact.
  client_sessions: "CASCADE",
  contact_notes: "CASCADE",
  contact_stripe_customers: "CASCADE",
  deals: "CASCADE",
  sales_calls: "CASCADE",
  tasks: "CASCADE",
  waitlist_entries: "CASCADE",
  // Block the delete instead, which is why a merge aborts for anyone who
  // ever applied.
  applications: "NO ACTION",
  waitlist_invitations: "NO ACTION",
};

/** The tables a Contact delete would destroy, worst first. */
export const CONTACT_CASCADE_TABLES = Object.entries(CONTACT_FK_DELETE_RULES)
  .filter(([, rule]) => rule === "CASCADE")
  .map(([table]) => table)
  .sort();
