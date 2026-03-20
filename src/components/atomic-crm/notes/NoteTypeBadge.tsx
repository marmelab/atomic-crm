import {
  Calendar,
  Clock,
  Coffee,
  FileText,
  Mail,
  MessageSquare,
  Monitor,
  Phone,
  RefreshCw,
  Star,
  Users,
  Video,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useConfigurationContext } from "../root/ConfigurationContext";

export const NOTE_TYPE_ICONS: Record<string, LucideIcon> = {
  phone: Phone,
  mail: Mail,
  users: Users,
  calendar: Calendar,
  "refresh-cw": RefreshCw,
  monitor: Monitor,
  "message-square": MessageSquare,
  coffee: Coffee,
  video: Video,
  "file-text": FileText,
  clock: Clock,
  star: Star,
  zap: Zap,
};

export const NOTE_TYPE_ICON_OPTIONS = [
  { value: "phone", label: "Phone" },
  { value: "mail", label: "Mail" },
  { value: "users", label: "Users" },
  { value: "calendar", label: "Calendar" },
  { value: "refresh-cw", label: "Follow-up" },
  { value: "monitor", label: "Monitor" },
  { value: "message-square", label: "Message" },
  { value: "coffee", label: "Coffee" },
  { value: "video", label: "Video" },
  { value: "file-text", label: "Document" },
  { value: "clock", label: "Clock" },
  { value: "star", label: "Star" },
  { value: "zap", label: "Zap" },
];

export const NoteTypeBadge = ({ type }: { type: string }) => {
  const { noteTypes } = useConfigurationContext();
  const noteType = noteTypes?.find((t) => t.value === type);

  if (!noteType || noteType.value === "none") return null;

  const IconComponent = noteType.icon ? NOTE_TYPE_ICONS[noteType.icon] : null;
  const bgColor = noteType.color;

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ml-2"
      style={
        bgColor
          ? {
              backgroundColor: bgColor + "33",
              color: bgColor,
              border: `1px solid ${bgColor}66`,
            }
          : {
              backgroundColor: "hsl(var(--muted))",
              color: "hsl(var(--muted-foreground))",
            }
      }
    >
      {IconComponent && <IconComponent className="w-3 h-3" />}
      {noteType.label}
    </span>
  );
};
