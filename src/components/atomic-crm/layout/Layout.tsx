import { Suspense, type ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/admin/app-sidebar";
import { Notification } from "@/components/admin/notification";
import { Error } from "@/components/admin/error";
import { Loading } from "@/components/admin/loading";

import { useConfigurationLoader } from "../root/useConfigurationLoader";
import Header from "./Header";

export const Layout = ({ children }: { children: ReactNode }) => {
  useConfigurationLoader();
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="ml-auto flex h-svh w-full max-w-full flex-col peer-data-[state=collapsed]:w-[calc(100%-var(--sidebar-width-icon)-1rem)] peer-data-[state=expanded]:w-[calc(100%-var(--sidebar-width))] sm:transition-[width] sm:duration-200 sm:ease-linear">
        <Header />
        <ErrorBoundary FallbackComponent={Error}>
          <Suspense fallback={<Loading />}>
            <div className="flex flex-1 flex-col overflow-auto px-4">
              {children}
            </div>
          </Suspense>
        </ErrorBoundary>
      </main>
      <Notification />
    </SidebarProvider>
  );
};
