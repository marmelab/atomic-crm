import { type ErrorInfo, Suspense, useState, type ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { cn } from "@/lib/utils";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { UserMenu } from "@/components/admin/user-menu";
import { ThemeModeToggle } from "@/components/admin/theme-mode-toggle";
import { Notification } from "@/components/admin/notification";
import { AppSidebar } from "@/components/admin/app-sidebar";
import { RefreshButton } from "@/components/admin/refresh-button";
import { Error } from "@/components/admin/error";
import { Skeleton } from "@/components/ui/skeleton";

export const Layout = ({ children }: { children: ReactNode }) => {
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | undefined>(undefined);
  const handleError = (_: Error, info: ErrorInfo) => {
    setErrorInfo(info);
  };
  return (
    <SidebarProvider>
      <AppSidebar />
      <div
        className={cn(
          "flex flex-1 flex-col min-h-svh",
          "transition-[margin] duration-200 ease-linear",
        )}
      >
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-6">
          <SidebarTrigger />
          <div className="flex-1" />
          <ThemeModeToggle />
          <RefreshButton />
          <UserMenu />
        </header>
        <main className="flex-1 overflow-auto">
          <ErrorBoundary
            onError={handleError}
            fallbackRender={({ error, resetErrorBoundary }) => (
              <Error
                error={error}
                errorInfo={errorInfo}
                resetErrorBoundary={resetErrorBoundary}
              />
            )}
          >
            <Suspense
              fallback={
                <div className="p-8">
                  <Skeleton className="h-8 w-48" />
                </div>
              }
            >
              <div className="p-6">{children}</div>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
      <Notification />
    </SidebarProvider>
  );
};
