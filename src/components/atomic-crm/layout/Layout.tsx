import { Suspense, type ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Notification } from "@/components/admin/notification";
import { Error } from "@/components/admin/error";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

import { FloatingFeedbackWidget } from "../feedback";
import { useConfigurationLoader } from "../root/useConfigurationLoader";
import { AppSidebar } from "./AppSidebar";
import Header from "./Header";

export const Layout = ({ children }: { children: ReactNode }) => {
  useConfigurationLoader();
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <Header />
        <main
          id="main-content"
          className="flex flex-1 flex-col gap-4 px-4 py-4 md:px-6"
        >
          <div className="mx-auto w-full max-w-[1600px]">
            <ErrorBoundary FallbackComponent={Error}>
              <Suspense
                fallback={<Skeleton className="h-12 w-12 rounded-full" />}
              >
                {children}
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>
      </SidebarInset>
      <Notification />
      <FloatingFeedbackWidget />
    </SidebarProvider>
  );
};
