import type Stripe from "npm:stripe@18.5.0";

import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { isLiveSchedule, isLiveSubscription } from "./stripeReconcile.ts";

// Read-only Stripe investigation. Writes NOTHING.
//
// It exists because "no active subscription" was being read as "no payment",
// and those are different facts. Emily Loeb paid in full and Jules
// Litman-Cleper is four installments into six; both read as Setup pending
// because the reconciler only ever asked Stripe about subscriptions and
// schedules. A one-time payment leaves no subscription at all, and a plan
// can be finished, cancelled or historical and still have collected money.
//
// So this asks three independent questions and keeps the answers apart:
//
//   ARRANGEMENT — subscription, schedule, or nothing.
//   MONEY RECEIVED — paid invoices, succeeded PaymentIntents, charges,
//                    completed Checkout Sessions.
//   IDENTITY — the linked customer, plus any other customer objects that
//              are discoverable for this person.
//
// Email IS used for discovery here, because discovery is not authority:
// nothing this function returns moves money data or relinks anybody. A
// human reads the report and decides. Linking still requires a
// deterministic customer id.

export type StripeCustomerFindings = {
  id: string;
  email: string | null;
  name: string | null;
  created: string;
  matchedBy: "crm_customer_id" | "email_discovery";
  // Arrangement
  subscriptions: {
    id: string;
    status: string;
    start: string | null;
    amount: number | null;
    currency: string | null;
    interval: string | null;
    live: boolean;
  }[];
  schedules: {
    id: string;
    status: string;
    start: string | null;
    phases: number;
    live: boolean;
  }[];
  // Money received
  paidInvoices: {
    id: string;
    amountPaid: number;
    currency: string;
    paidAt: string | null;
    subscription: string | null;
  }[];
  succeededPaymentIntents: {
    id: string;
    amount: number;
    currency: string;
    created: string;
    description: string | null;
  }[];
  succeededCharges: {
    id: string;
    amount: number;
    currency: string;
    created: string;
    invoice: string | null;
    paymentIntent: string | null;
  }[];
  completedCheckoutSessions: {
    id: string;
    amountTotal: number | null;
    currency: string | null;
    created: string;
    mode: string;
  }[];
  // Identity / setup
  paymentMethods: number;
  setupIntents: { id: string; status: string; created: string }[];
  errors: string[];
};

export type StripeInvestigation = {
  contactId: number;
  contactName: string | null;
  crmLinkedCustomerId: string | null;
  emailsSearched: string[];
  customers: StripeCustomerFindings[];
  totals: {
    receivedMinor: number;
    currencies: string[];
    paidInvoiceCount: number;
    succeededPaymentCount: number;
    liveArrangements: number;
  };
  // Stated separately from the raw facts, so nobody has to infer it.
  conclusion: string;
};

const iso = (seconds: number | null | undefined): string | null =>
  seconds == null ? null : new Date(seconds * 1000).toISOString();

const subscriptionIdOf = (value: unknown): string | null =>
  typeof value === "string"
    ? value
    : ((value as { id?: string } | null)?.id ?? null);

// Every customer object Stripe can be asked about for this person. The
// linked id is authority; email hits are candidates for a human to judge.
const discoverCustomers = async (
  stripe: Stripe,
  linkedId: string | null,
  emails: string[],
): Promise<Map<string, StripeCustomerFindings["matchedBy"]>> => {
  const ids = new Map<string, StripeCustomerFindings["matchedBy"]>();
  if (linkedId) ids.set(linkedId, "crm_customer_id");

  for (const email of emails) {
    try {
      const found = await stripe.customers.list({ email, limit: 50 });
      for (const customer of found.data) {
        if (!ids.has(customer.id)) ids.set(customer.id, "email_discovery");
      }
    } catch {
      // Discovery is best-effort. Failing to find extra candidates must
      // never fail the report on the customer we do know.
    }
  }
  return ids;
};

const investigateCustomer = async (
  stripe: Stripe,
  id: string,
  matchedBy: StripeCustomerFindings["matchedBy"],
): Promise<StripeCustomerFindings> => {
  const findings: StripeCustomerFindings = {
    id,
    email: null,
    name: null,
    created: "",
    matchedBy,
    subscriptions: [],
    schedules: [],
    paidInvoices: [],
    succeededPaymentIntents: [],
    succeededCharges: [],
    completedCheckoutSessions: [],
    paymentMethods: 0,
    setupIntents: [],
    errors: [],
  };

  // Each read is independent: one failing endpoint must not blank out the
  // evidence the others found.
  const attempt = async (label: string, run: () => Promise<void>) => {
    try {
      await run();
    } catch (error) {
      findings.errors.push(
        `${label}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  await attempt("customer", async () => {
    const customer = (await stripe.customers.retrieve(id)) as Stripe.Customer;
    findings.email = customer.email ?? null;
    findings.name = customer.name ?? null;
    findings.created = iso(customer.created) ?? "";
  });

  await attempt("subscriptions", async () => {
    const list = await stripe.subscriptions.list({
      customer: id,
      status: "all",
      limit: 50,
    });
    findings.subscriptions = list.data.map((s) => ({
      id: s.id,
      status: s.status,
      start: iso(s.start_date),
      amount: s.items?.data?.[0]?.price?.unit_amount ?? null,
      currency: s.items?.data?.[0]?.price?.currency ?? null,
      interval: s.items?.data?.[0]?.price?.recurring?.interval ?? null,
      live: isLiveSubscription(s),
    }));
  });

  await attempt("schedules", async () => {
    const list = await stripe.subscriptionSchedules.list({
      customer: id,
      limit: 50,
    });
    findings.schedules = list.data.map((s) => ({
      id: s.id,
      status: s.status,
      start: iso(s.phases?.[0]?.start_date),
      phases: s.phases?.length ?? 0,
      live: isLiveSchedule(s),
    }));
  });

  await attempt("invoices", async () => {
    const list = await stripe.invoices.list({ customer: id, limit: 100 });
    findings.paidInvoices = list.data
      .filter((i) => i.status === "paid" && (i.amount_paid ?? 0) > 0)
      .map((i) => ({
        id: i.id ?? "",
        amountPaid: i.amount_paid ?? 0,
        currency: i.currency ?? "",
        paidAt: iso(i.status_transitions?.paid_at),
        subscription: subscriptionIdOf(
          (i as unknown as { subscription?: unknown }).subscription,
        ),
      }));
  });

  // The one-time payment case. A client who paid in full outside a
  // subscription leaves a PaymentIntent and a charge, and nothing else.
  await attempt("payment_intents", async () => {
    const list = await stripe.paymentIntents.list({ customer: id, limit: 100 });
    findings.succeededPaymentIntents = list.data
      .filter((p) => p.status === "succeeded" && (p.amount_received ?? 0) > 0)
      .map((p) => ({
        id: p.id,
        amount: p.amount_received ?? p.amount,
        currency: p.currency,
        created: iso(p.created) ?? "",
        description: p.description ?? null,
      }));
  });

  await attempt("charges", async () => {
    const list = await stripe.charges.list({ customer: id, limit: 100 });
    findings.succeededCharges = list.data
      .filter((c) => c.status === "succeeded" && !c.refunded)
      .map((c) => ({
        id: c.id,
        amount: c.amount_captured ?? c.amount,
        currency: c.currency,
        created: iso(c.created) ?? "",
        invoice: subscriptionIdOf(
          (c as unknown as { invoice?: unknown }).invoice,
        ),
        paymentIntent: subscriptionIdOf(
          (c as unknown as { payment_intent?: unknown }).payment_intent,
        ),
      }));
  });

  await attempt("checkout_sessions", async () => {
    const list = await stripe.checkout.sessions.list({
      customer: id,
      limit: 100,
    });
    findings.completedCheckoutSessions = list.data
      .filter((s) => s.payment_status === "paid" || s.status === "complete")
      .map((s) => ({
        id: s.id,
        amountTotal: s.amount_total ?? null,
        currency: s.currency ?? null,
        created: iso(s.created) ?? "",
        mode: s.mode,
      }));
  });

  await attempt("payment_methods", async () => {
    const list = await stripe.paymentMethods.list({ customer: id, limit: 50 });
    findings.paymentMethods = list.data.length;
  });

  // Reported plainly, and never counted as money: a SetupIntent proves a
  // payment method was prepared, nothing more.
  await attempt("setup_intents", async () => {
    const list = await stripe.setupIntents.list({ customer: id, limit: 50 });
    findings.setupIntents = list.data.map((i) => ({
      id: i.id,
      status: i.status,
      created: iso(i.created) ?? "",
    }));
  });

  return findings;
};

// Charges raised by an invoice are the same money as the invoice, and a
// PaymentIntent is the same money as its charge. Counting all three would
// treble a single installment, so each payment is counted once.
const countReceived = (
  customers: StripeCustomerFindings[],
): { minor: number; currencies: string[]; payments: number } => {
  let minor = 0;
  let payments = 0;
  const currencies = new Set<string>();

  for (const customer of customers) {
    const invoicedCharges = new Set(
      customer.succeededCharges
        .filter((c) => c.invoice != null)
        .map((c) => c.id),
    );
    const chargePaymentIntents = new Set(
      customer.succeededCharges
        .map((c) => c.paymentIntent)
        .filter((id): id is string => id != null),
    );

    for (const invoice of customer.paidInvoices) {
      minor += invoice.amountPaid;
      payments += 1;
      if (invoice.currency) currencies.add(invoice.currency);
    }
    for (const charge of customer.succeededCharges) {
      if (invoicedCharges.has(charge.id)) continue; // already counted
      minor += charge.amount;
      payments += 1;
      currencies.add(charge.currency);
    }
    for (const intent of customer.succeededPaymentIntents) {
      if (chargePaymentIntents.has(intent.id)) continue; // already counted
      minor += intent.amount;
      payments += 1;
      currencies.add(intent.currency);
    }
  }

  return { minor, currencies: [...currencies], payments };
};

const concludeFrom = (
  customers: StripeCustomerFindings[],
  received: { minor: number; payments: number },
  liveArrangements: number,
): string => {
  const elsewhere = customers.some(
    (c) =>
      c.matchedBy === "email_discovery" &&
      (c.paidInvoices.length > 0 ||
        c.succeededPaymentIntents.length > 0 ||
        c.subscriptions.some((s) => s.live) ||
        c.schedules.some((s) => s.live)),
  );

  const parts: string[] = [];
  if (liveArrangements > 0) {
    parts.push("A live subscription or schedule exists.");
  } else if (received.payments > 0) {
    parts.push(
      `No live arrangement, but ${received.payments} successful payment(s) were collected — money exists without a subscription.`,
    );
  } else {
    parts.push(
      "No arrangement and no successful payment found. Any SetupIntent here proves only that a payment method was prepared.",
    );
  }
  if (elsewhere) {
    parts.push(
      "Evidence was found on a customer object the CRM is NOT linked to — needs a human decision before relinking.",
    );
  }
  return parts.join(" ");
};

export const investigateStripe = async (
  stripe: Stripe,
  params: { contactId: number },
): Promise<StripeInvestigation> => {
  const { data } = await supabaseAdmin
    .from("contacts")
    .select("id, first_name, last_name, stripe_customer_id, email_jsonb")
    .eq("id", params.contactId)
    .maybeSingle();
  const contact = data as {
    id: number;
    first_name: string | null;
    last_name: string | null;
    stripe_customer_id: string | null;
    email_jsonb: { email: string }[] | null;
  } | null;

  const crmLinkedCustomerId = contact?.stripe_customer_id ?? null;
  const emails = (contact?.email_jsonb ?? [])
    .map((entry) => entry.email)
    .filter(
      (email) =>
        typeof email === "string" &&
        email.includes("@") &&
        !email.startsWith("le-standalone:"),
    );

  const ids = await discoverCustomers(stripe, crmLinkedCustomerId, emails);
  const customers: StripeCustomerFindings[] = [];
  for (const [id, matchedBy] of ids) {
    customers.push(await investigateCustomer(stripe, id, matchedBy));
  }

  const received = countReceived(customers);
  const liveArrangements = customers.reduce(
    (total, c) =>
      total +
      c.subscriptions.filter((s) => s.live).length +
      c.schedules.filter((s) => s.live).length,
    0,
  );

  return {
    contactId: params.contactId,
    contactName:
      [contact?.first_name, contact?.last_name].filter(Boolean).join(" ") ||
      null,
    crmLinkedCustomerId,
    emailsSearched: emails,
    customers,
    totals: {
      receivedMinor: received.minor,
      currencies: received.currencies,
      paidInvoiceCount: customers.reduce(
        (total, c) => total + c.paidInvoices.length,
        0,
      ),
      succeededPaymentCount: received.payments,
      liveArrangements,
    },
    conclusion: concludeFrom(customers, received, liveArrangements),
  };
};
