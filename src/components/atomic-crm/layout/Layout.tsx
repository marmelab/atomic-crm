import { Suspense, type ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Notification } from "@/components/admin/notification";
import { Error } from "@/components/admin/error";
import { Skeleton } from "@/components/ui/skeleton";

import Header from "./Header";

export const Layout = ({ children }: { children: ReactNode }) => (
  <>
    <Header />
    <main className="max-w-screen-xl mx-auto pt-4 px-4" id="main-content">
      <ErrorBoundary FallbackComponent={Error}>
        <Suspense fallback={<Skeleton className="h-12 w-12 rounded-full" />}>
          {children}
        </Suspense>
      </ErrorBoundary>
    </main>
    <Notification />
  </>
);
