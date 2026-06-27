import { cn } from "@/lib/utils";

import type { OutreachStatus } from "../types";

const CONFIG: Record<OutreachStatus, { label: string; className: string }> = {
  not_contacted: {
    label: "Not contacted",
    className: "bg-gray-100 text-gray-600",
  },
  queued: { label: "Queued", className: "bg-sky-100 text-sky-700" },
  emailed: { label: "Emailed", className: "bg-blue-100 text-blue-700" },
  opened: { label: "Opened", className: "bg-indigo-100 text-indigo-700" },
  replied: { label: "Replied", className: "bg-amber-100 text-amber-800" },
  interested: { label: "Interested", className: "bg-green-100 text-green-700" },
  meeting_booked: {
    label: "Meeting booked",
    className: "bg-emerald-100 text-emerald-700",
  },
  closed: { label: "Closed", className: "bg-emerald-200 text-emerald-900" },
  bounced: { label: "Bounced", className: "bg-red-100 text-red-700" },
  unsubscribed: { label: "Unsubscribed", className: "bg-red-100 text-red-700" },
  not_interested: {
    label: "Not interested",
    className: "bg-rose-100 text-rose-700",
  },
  wrong_person: {
    label: "Wrong person",
    className: "bg-rose-100 text-rose-700",
  },
};

// A clear, color-coded chip summarizing where a contact sits in outreach.
export const OutreachStatusBadge = ({
  status,
  className,
}: {
  status?: OutreachStatus | null;
  className?: string;
}) => {
  const config = CONFIG[status ?? "not_contacted"] ?? CONFIG.not_contacted;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
};
