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
export const Section = ({
  title,
  id,
  children,
}: {
  title: string;
  id?: string;
  children: ReactNode;
}) => (
  <div
    id={id}
    className={id ? "flex flex-col gap-3 scroll-mt-4" : "flex flex-col gap-3"}
  >
    <h2 className="text-xl font-semibold">{title}</h2>
    {children}
  </div>
);

// One rounded row: a person's name (linking to their Contact by default, or
// `to` for a more specific destination such as the Opportunity in
// question) plus a short trailing context (a Badge, a status string, a
// date) — the same shape as the Living Example page's Current Clients /
// Upcoming Openings rows.
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
  <Card>
    <CardContent className="flex items-center justify-between gap-4 py-3">
      <div className="flex min-w-0 flex-col">
        <Link
          to={to ?? `/contacts/${contactId}/show`}
          className="text-sm font-medium hover:underline"
        >
          {name}
        </Link>
        {meta && (
          <span className="text-xs text-muted-foreground truncate">{meta}</span>
        )}
      </div>
      {trailing}
    </CardContent>
  </Card>
);
