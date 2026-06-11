import { Error } from "@/components/admin/error";
import { Notification } from "@/components/admin/notification";
import { Skeleton } from "@/components/ui/skeleton";
import { Suspense, useEffect, type ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { FloatingFeedbackWidget } from "../feedback";
import { useConfigurationLoader } from "../root/useConfigurationLoader";
import { MobileNavigation } from "./MobileNavigation";
import { mobileLayoutVars } from "./mobileLayoutConstants";

export const MobileLayout = ({ children }: { children: ReactNode }) => {
  useConfigurationLoader();

  useEffect(() => {
    const root = document.documentElement;
    const previousValues = Object.fromEntries(
      Object.keys(mobileLayoutVars).map((key) => [
        key,
        root.style.getPropertyValue(key),
      ]),
    );

    Object.entries(mobileLayoutVars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    return () => {
      Object.entries(previousValues).forEach(([key, value]) => {
        if (value) {
          root.style.setProperty(key, value);
        } else {
          root.style.removeProperty(key);
        }
      });
    };
  }, []);

  return (
    <div
      className="min-h-dvh bg-background overflow-x-clip"
      style={mobileLayoutVars}
    >
      <ErrorBoundary FallbackComponent={Error}>
        <Suspense fallback={<Skeleton className="h-12 w-12 rounded-full" />}>
          {children}
        </Suspense>
      </ErrorBoundary>
      <MobileNavigation />
      <FloatingFeedbackWidget />
      <Notification
        mobileOffset={{ bottom: "calc(var(--crm-mobile-nav-height) + 1rem)" }}
      />
    </div>
  );
};
