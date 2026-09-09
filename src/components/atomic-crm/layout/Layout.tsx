import { Suspense, type ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Notification } from "@/components/admin/notification";
import { Error } from "@/components/admin/error";
import { Skeleton } from "@/components/ui/skeleton";

import { useConfigurationLoader } from "../root/useConfigurationLoader";
import Header from "./Header";

export const Layout = ({ children }: { children: ReactNode }) => {
  useConfigurationLoader();
  return (
    <>
      <Header />
      {/* Human-acceptance repair (global bottom breathing room): the last
          card/accordion/table on a page used to end flush against the
          viewport's own bottom edge — no fixed/sticky bottom UI on desktop
          to account for, so a plain bottom padding is enough. Matches
          MobileContent.tsx's own `pb-20` (80px) exactly, so desktop and
          mobile share the same breathing room via the SAME already-proven
          value rather than inventing a second one. */}
      <main
        className="max-w-screen-xl mx-auto pt-4 px-4 pb-20"
        id="main-content"
      >
        <ErrorBoundary FallbackComponent={Error}>
          <Suspense fallback={<Skeleton className="h-12 w-12 rounded-full" />}>
            {children}
          </Suspense>
        </ErrorBoundary>
      </main>
      <Notification />
    </>
  );
};
