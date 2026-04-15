import * as Sentry from "@sentry/react";
import { Suspense, type ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Notification } from "@/components/admin/notification";
import { Error } from "@/components/admin/error";
import { Skeleton } from "@/components/ui/skeleton";

import { AssistProvider } from "../assist/assistStore";
import { NoshoAssistChat } from "../assist/NoshoAssistChat";
import { NoshoAssistFAB } from "../assist/NoshoAssistFAB";
import { useConfigurationLoader } from "../root/useConfigurationLoader";
import Header from "./Header";

const SentryErrorBoundary = Sentry.withErrorBoundary(
  ({ children }: { children: ReactNode }) => <>{children}</>,
  {
    fallback: ({ error, resetError }) => (
      <Error error={error} resetErrorBoundary={resetError} />
    ),
  },
);

export const Layout = ({ children }: { children: ReactNode }) => {
  useConfigurationLoader();
  return (
    <AssistProvider>
      <Header />
      <main className="w-full pt-4 px-[50px]" id="main-content">
        <SentryErrorBoundary>
          <ErrorBoundary FallbackComponent={Error}>
            <Suspense
              fallback={<Skeleton className="h-12 w-12 rounded-full" />}
            >
              {children}
            </Suspense>
          </ErrorBoundary>
        </SentryErrorBoundary>
      </main>
      <NoshoAssistFAB />
      <NoshoAssistChat />
      <Notification />
    </AssistProvider>
  );
};
