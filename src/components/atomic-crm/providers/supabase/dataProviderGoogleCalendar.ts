import { extractEdgeFunctionErrorMessage } from "./edgeFunctions";

type InvokeEdgeFunction = <T>(
  functionName: string,
  options?: { method?: string; body?: unknown },
) => Promise<{ data: T | null; error: unknown }>;

interface CalendarSyncResult {
  data: {
    google_event_id?: string;
    deleted?: string;
    message?: string;
  };
}

export const buildGoogleCalendarProviderMethods = (deps: {
  invokeEdgeFunction: InvokeEdgeFunction;
}) => {
  const syncServiceToCalendar = async (
    action: "create" | "update" | "delete",
    serviceId: string,
  ) => {
    const { data, error } =
      await deps.invokeEdgeFunction<CalendarSyncResult>(
        "google_calendar_sync",
        {
          method: "POST",
          body: { action, service_id: serviceId },
        },
      );

    if (!data || error) {
      console.error("syncServiceToCalendar.error", error);
      throw new Error(
        await extractEdgeFunctionErrorMessage(
          error,
          "Calendar sync failed",
        ),
      );
    }

    return data.data;
  };

  return { syncServiceToCalendar };
};
