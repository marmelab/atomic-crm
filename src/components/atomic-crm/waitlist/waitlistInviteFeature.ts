// Gmail delivery does not exist yet. The invitation DOMAIN model is real
// and deployed (batches, per-person invitations, history, booking
// attribution) — but the bulk execution UI would read, in plain English, as
// "these 37 people have been invited" while nothing is actually sent.
//
// That ambiguity is unacceptable in production, so the bulk action stays
// hidden until a delivery mechanism exists. Nothing is deleted or rolled
// back: the schema, domain actions, types, tests and Contact-history
// integration all ship, and flipping this flag turns the UI on.
//
// Same mechanism the app already uses to gate a whole settings section on
// VITE_INBOUND_EMAIL — unset means the feature is simply not there.
//
// The individual "Mark Invited" action is deliberately NOT gated: it means
// "Leif invited this person himself, outside the CRM", which is truthful
// today and records a real invitation with delivery_method 'manual'.
export const isBulkInviteDeliveryEnabled = (): boolean =>
  import.meta.env.VITE_ENABLE_WAITLIST_INVITE_DELIVERY === "true";
