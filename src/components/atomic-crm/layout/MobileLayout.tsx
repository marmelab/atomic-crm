import { Error } from "@/components/admin/error";
import { Notification } from "@/components/admin/notification";
import { Skeleton } from "@/components/ui/skeleton";
import { Suspense, type ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { MobileNavigation } from "./MobileNavigation";
import { MobileContent } from "./MobileContent";
import { MobileAppBar } from "./MobileAppBar";

export const MobileLayout = ({ children }: { children: ReactNode }) => (
  <>
    <MobileAppBar />
    <MobileContent>
      <ErrorBoundary FallbackComponent={Error}>
        <Suspense fallback={<Skeleton className="h-12 w-12 rounded-full" />}>
          {children}
        </Suspense>
      </ErrorBoundary>
    </MobileContent>
    <MobileNavigation />
    <Notification />
  </>
);
