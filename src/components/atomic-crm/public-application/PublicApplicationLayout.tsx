import type { ReactNode } from "react";

import applicationCover from "./application-cover.jpg";

// The public /apply pages' own calm, standalone shell — deliberately NOT
// the admin Layout/MobileLayout: no sidebar, no nav, no CRM chrome.
//
// Real LE + GYU Application Forms slice (Phase 5): recreates the visual
// feel of Leif's own Notion questionnaires that he specifically likes —
// very dark background, a centered narrow column with generous breathing
// room, a large strong page title, and a small simple intro underneath.
// Deliberately fixed dark colors rather than the app's own light/dark
// theme tokens: Leif's reference forms have one deliberate look
// regardless of a visitor's system preference, same as a standalone
// public questionnaire always renders one way. This does NOT touch
// components/admin/theme-provider.tsx or any other themed surface — only
// these specific public routes.
//
// Human-acceptance round 2: an optional wide Notion-page-style cover
// image, rendered above the title only when `cover` is true — the two
// real "open" application pages pass it; the "not found"/"cohort closed"
// fallback states (also rendered through this same shell) deliberately
// don't, unchanged from before this round.
export const PublicApplicationLayout = ({
  title,
  orientation,
  cover,
  children,
}: {
  title: string;
  // ReactNode, not just string: final visual-polish round — the two-
  // sentence intro copy was wrapping awkwardly as one browser-flowed
  // paragraph. LivingExampleApplicationPage / GrowingYourselfUpApplicationPage
  // now pass a <br /> between the two approved sentences (wording
  // untouched) instead of a single long string; this stays ONE semantic
  // <p> either way (a <br/> doesn't split it into separate elements), and
  // a plain string still works for the "not found"/"cohort closed"
  // fallback states below.
  orientation: ReactNode;
  cover?: boolean;
  children: ReactNode;
}) => (
  <div className="min-h-screen bg-[#0a0a0d] text-white flex justify-center px-4 py-14 sm:py-20">
    <div className="w-full max-w-xl flex flex-col gap-10">
      {cover && (
        <div className="w-full overflow-hidden rounded-2xl">
          {/* Decorative only — the title right below already states what
              the page is; this image carries no information a screen
              reader needs (Phase 6: "treat as decorative unless the
              architecture calls for meaningful alt text"). object-fit +
              a deliberately chosen object-position crop the portrait
              source down to a shallow banner that keeps the tea tray /
              cups / French press in frame instead of the empty blanket
              above them — nondestructive: the source file itself is
              untouched, only ever displayed through CSS cropping.
              Final visual-polish round: nudged from 45% to 38% to bring a
              hint of the original photo's green plant sprigs into the
              upper-right corner (Leif's ask), while keeping both cups
              fully visible — verified this is the outer edge of that
              tradeoff: values below ~36% start clipping the front cup's
              base to gain more greenery, which the same feedback
              explicitly ranks below full cup visibility. Micro-tuned once
              more to 39%: 38% clipped the front cup's breathing room a
              touch more than Leif wanted, so this nudges back just enough
              to restore it while keeping only the tiniest sliver of green
              (rather than the more visible patch at 38%). */}
          <img
            src={applicationCover}
            alt=""
            className="w-full h-36 sm:h-44 md:h-52 object-cover object-[center_39%]"
          />
        </div>
      )}
      <div className="flex flex-col gap-3 text-center">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">
          {title}
        </h1>
        <p className="text-base text-white/50">{orientation}</p>
      </div>
      {children}
    </div>
  </div>
);
