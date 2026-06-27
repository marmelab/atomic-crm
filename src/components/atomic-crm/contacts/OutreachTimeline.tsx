import {
  Ban,
  CalendarCheck,
  CheckCircle2,
  Mail,
  MailOpen,
  Minus,
  MousePointerClick,
  Reply,
  Send,
  Star,
  ThumbsDown,
  UserX,
} from "lucide-react";
import type { ComponentType } from "react";
import { WithListContext } from "ra-core";
import { ReferenceManyField } from "@/components/admin/reference-many-field";

import { useRelativeDate } from "../misc/RelativeDate";
import type { OutreachEvent, OutreachEventType } from "../types";

const EVENT_META: Record<
  OutreachEventType,
  { icon: ComponentType<{ className?: string }>; label: string }
> = {
  queued: { icon: Send, label: "Queued to campaign" },
  emailed: { icon: Mail, label: "Emailed" },
  opened: { icon: MailOpen, label: "Opened" },
  clicked: { icon: MousePointerClick, label: "Clicked a link" },
  replied: { icon: Reply, label: "Replied" },
  bounced: { icon: Ban, label: "Bounced" },
  interested: { icon: Star, label: "Interested" },
  not_interested: { icon: ThumbsDown, label: "Not interested" },
  neutral: { icon: Minus, label: "Neutral reply" },
  meeting_booked: { icon: CalendarCheck, label: "Meeting booked" },
  closed: { icon: CheckCircle2, label: "Closed" },
  unsubscribed: { icon: UserX, label: "Unsubscribed" },
  wrong_person: { icon: UserX, label: "Wrong person" },
};

const OutreachEventRow = ({ event }: { event: OutreachEvent }) => {
  const meta = EVENT_META[event.type] ?? { icon: Minus, label: event.type };
  const Icon = meta.icon;
  const when = useRelativeDate(event.occurred_at);
  const exact = new Date(event.occurred_at).toLocaleString();

  return (
    <div className="flex gap-2 py-1.5">
      <Icon className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0 text-sm">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-medium">{meta.label}</span>
          {event.campaign && (
            <span className="text-muted-foreground">· {event.campaign}</span>
          )}
          <span className="text-muted-foreground text-xs" title={exact}>
            · {when}
          </span>
        </div>
        {event.summary && (
          <div className="text-muted-foreground truncate" title={event.summary}>
            {event.summary}
          </div>
        )}
      </div>
    </div>
  );
};

// A clean, timestamped trail of every outreach event for a contact.
export const OutreachTimeline = () => (
  <ReferenceManyField
    reference="outreach_events"
    target="contact_id"
    sort={{ field: "occurred_at", order: "DESC" }}
    perPage={50}
  >
    <WithListContext<OutreachEvent>
      render={({ data }) =>
        !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-1">
            No outreach activity yet.
          </p>
        ) : (
          <div className="flex flex-col">
            {data.map((event) => (
              <OutreachEventRow key={event.id} event={event} />
            ))}
          </div>
        )
      }
    />
  </ReferenceManyField>
);
