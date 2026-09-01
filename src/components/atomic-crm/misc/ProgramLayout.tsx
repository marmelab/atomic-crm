import type { ReactNode } from "react";
import { Link } from "react-router";
import { Card, CardContent } from "@/components/ui/card";

// Shared visual language for "program-shaped" pages (the Living Example /
// any 1:1 Offer page, and now Cohort detail pages) — extracted so the two
// visibly feel like members of the same product family instead of a custom
// page next to a stock Atomic screen (Runtime + Visual Consistency slice,
// §2/§7). Deliberately small: three primitives, not a design system.

// Eyebrow (optional parent context) + title + a one-line stat summary.
export const PageHeader = ({
  eyebrow,
  title,
  summary,
}: {
  eyebrow?: ReactNode;
  title: string;
  summary?: ReactNode;
}) => (
  <div>
    {eyebrow && <p className="text-sm text-muted-foreground">{eyebrow}</p>}
    <h1 className="text-2xl font-semibold">{title}</h1>
    {summary && <p className="text-lg text-muted-foreground">{summary}</p>}
  </div>
);

// A titled group of content — the "clean rounded section" unit. Content is
// left to the caller (a list of PersonCard rows, a details Card, an empty
// state) so this stays a layout primitive, not a data component.
//
// `emphasis` (Applications hierarchy repair): "primary" (default, unchanged
// for every existing caller) is the full text-xl heading. "secondary" is
// for a Section nested under a more important heading of its own (e.g. a
// Cohort's Section nested under its parent Offer's heading) — smaller and
// muted, so the parent stays visually primary.
export const Section = ({
  title,
  id,
  emphasis = "primary",
  children,
}: {
  title: string;
  id?: string;
  emphasis?: "primary" | "secondary";
  children: ReactNode;
}) => (
  <div
    id={id}
    className={id ? "flex flex-col gap-3 scroll-mt-4" : "flex flex-col gap-3"}
  >
    <h2
      className={
        emphasis === "secondary"
          ? "text-base font-medium text-muted-foreground"
          : "text-xl font-semibold"
      }
    >
      {title}
    </h2>
    {children}
  </div>
);

// One rounded row: a person's name (linking to their Contact by default, or
// `to` for a more specific destination such as the Opportunity in
// question) plus a short trailing context (a Badge, a status string, a
// date) — the same shape as the Living Example page's Current Clients /
// Upcoming Openings rows.
//
// Density pass: Card's own default `py-6` was compounding with this row's
// `py-3` (48px + 24px of pure vertical padding per row before any content)
// — the CRM-wide "oversized list card" complaint traced back to exactly
// this. `p-0` on Card removes its ambient padding (same technique
// waitlist/WaitlistSection.tsx's own outer Card already uses), leaving
// CardContent's own tight `px-4 py-2.5` — the Waitlist row's own density —
// as the only padding. Still one full rounded Card per record (not merged
// into a shared divide-y list): every PersonCard-based section (Enrolled
// Clients, People Deciding, Applications, Current Clients, and the single
// "Related Sales" card on the Application detail page) gets this for free.
export const PersonCard = ({
  contactId,
  to,
  name,
  meta,
  trailing,
}: {
  contactId: string | number;
  to?: string;
  name: string;
  meta?: ReactNode;
  trailing?: ReactNode;
}) => (
  <Card className="p-0">
    <CardContent className="flex items-center justify-between gap-3 px-4 py-2.5">
      <div className="flex min-w-0 flex-col">
        <Link
          to={to ?? `/contacts/${contactId}/show`}
          className="text-sm font-medium hover:underline truncate"
        >
          {name}
        </Link>
        {meta && (
          <span className="text-xs text-muted-foreground truncate">{meta}</span>
        )}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </CardContent>
  </Card>
);
