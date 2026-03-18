import { useQuery } from "@tanstack/react-query";
import { useDataProvider, useRecordContext } from "ra-core";
import { Calendar, Clock, ExternalLink, Loader2 } from "lucide-react";
import type { CrmDataProvider } from "../providers/types";
import type { Contact } from "../types";
import type { GoogleCalendarEvent } from "../google/types";

export const ContactCalendarEvents = () => {
  const record = useRecordContext<Contact>();
  const dataProvider = useDataProvider<CrmDataProvider>();

  const emails =
    record?.email_jsonb
      ?.map((e) => e.email)
      .filter((e): e is string => !!e) ?? [];

  const { data, isPending, error } = useQuery({
    queryKey: ["google-calendar-contact", record?.id],
    queryFn: () =>
      dataProvider.getContactCalendarEvents(emails, {
        timeMin: new Date(
          Date.now() - 90 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        timeMax: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        maxResults: 10,
      }),
    enabled: emails.length > 0,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (!emails.length) {
    return (
      <p className="text-xs text-muted-foreground py-2">
        Aucun email renseigné
      </p>
    );
  }

  if (error) return null;

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data?.events?.length) {
    return (
      <p className="text-xs text-muted-foreground py-2">
        Aucun rendez-vous trouvé
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {data.events.map((event) => (
        <CalendarEventItem key={event.id} event={event} />
      ))}
    </div>
  );
};

const CalendarEventItem = ({ event }: { event: GoogleCalendarEvent }) => {
  const startDate = event.start.dateTime
    ? new Date(event.start.dateTime)
    : event.start.date
      ? new Date(event.start.date)
      : null;

  const isAllDay = !event.start.dateTime && !!event.start.date;
  const isPast = startDate ? startDate < new Date() : false;

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  const formatDate = (date: Date) =>
    date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  return (
    <a
      href={event.htmlLink ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex gap-2 p-1.5 rounded-md hover:bg-muted/50 transition-colors group ${
        isPast ? "opacity-60" : ""
      }`}
    >
      <Calendar className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium truncate">
            {event.summary || "(sans titre)"}
          </span>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {startDate ? formatDate(startDate) : ""}
          </span>
        </div>
        {!isAllDay && startDate && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="h-2.5 w-2.5" />
            {formatTime(startDate)}
          </div>
        )}
      </div>
      <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0 mt-1" />
    </a>
  );
};
