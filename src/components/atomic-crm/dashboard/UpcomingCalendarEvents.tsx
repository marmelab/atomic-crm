import { useQuery } from "@tanstack/react-query";
import { useDataProvider } from "ra-core";
import { Calendar, Clock, MapPin, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { CrmDataProvider } from "../providers/types";
import type { GoogleCalendarEvent } from "../google/types";

export const UpcomingCalendarEvents = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();

  const { data, isPending, error } = useQuery({
    queryKey: ["google-calendar-upcoming"],
    queryFn: () =>
      dataProvider.getUpcomingCalendarEvents({
        timeMin: new Date().toISOString(),
        timeMax: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        maxResults: 8,
      }),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (error) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center">
        <div className="mr-3 flex items-center justify-center w-7 h-7 rounded-lg bg-blue-500/10">
          <Calendar className="text-blue-600 dark:text-blue-400 w-4 h-4" />
        </div>
        <h2 className="text-base font-semibold text-muted-foreground flex-1">
          Prochains rendez-vous
        </h2>
      </div>
      <Card className="p-4 mb-2 shadow-sm border-border/50">
        {isPending ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            Chargement...
          </div>
        ) : !data?.events?.length ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            Aucun rendez-vous cette semaine
          </div>
        ) : (
          <div className="space-y-1">
            {data.events.map((event) => (
              <CalendarEventItem key={event.id} event={event} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

const CalendarEventItem = ({ event }: { event: GoogleCalendarEvent }) => {
  const startDate = event.start.dateTime
    ? new Date(event.start.dateTime)
    : event.start.date
      ? new Date(event.start.date)
      : null;

  const endDate = event.end.dateTime ? new Date(event.end.dateTime) : null;

  const isAllDay = !event.start.dateTime && !!event.start.date;

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  const formatDate = (date: Date) =>
    date.toLocaleDateString("fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });

  const isToday =
    startDate &&
    startDate.toDateString() === new Date().toDateString();

  const isTomorrow =
    startDate &&
    startDate.toDateString() ===
      new Date(Date.now() + 86400000).toDateString();

  const dayLabel = isToday
    ? "Aujourd'hui"
    : isTomorrow
      ? "Demain"
      : startDate
        ? formatDate(startDate)
        : "";

  return (
    <a
      href={event.htmlLink ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors group"
    >
      {/* Time column */}
      <div className="w-16 shrink-0 text-right">
        <div className="text-xs font-medium text-muted-foreground">
          {dayLabel}
        </div>
        {!isAllDay && startDate && (
          <div className="text-xs text-muted-foreground">
            {formatTime(startDate)}
          </div>
        )}
      </div>

      {/* Colored bar */}
      <div
        className={`w-0.5 rounded-full shrink-0 ${
          isToday ? "bg-blue-500" : "bg-muted-foreground/30"
        }`}
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-sm font-medium truncate">
            {event.summary || "(sans titre)"}
          </span>
          <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
        </div>

        {!isAllDay && startDate && endDate && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
            <Clock className="h-3 w-3" />
            {formatTime(startDate)} - {formatTime(endDate)}
          </div>
        )}

        {event.location && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
            <MapPin className="h-3 w-3" />
            <span className="truncate">{event.location}</span>
          </div>
        )}

        {event.attendees.length > 0 && (
          <div className="text-xs text-muted-foreground mt-0.5 truncate">
            {event.attendees
              .slice(0, 3)
              .map((a) => a.displayName || a.email)
              .join(", ")}
            {event.attendees.length > 3 &&
              ` +${event.attendees.length - 3}`}
          </div>
        )}
      </div>
    </a>
  );
};
