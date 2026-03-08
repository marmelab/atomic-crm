import {
  AlertTriangle,
  CheckCircle2,
  Info,
  type LucideIcon,
  XCircle,
} from "lucide-react";

type CalloutTone = "success" | "warning" | "info" | "error";

const toneStyles: Record<
  CalloutTone,
  { border: string; bg: string; text: string; Icon: LucideIcon }
> = {
  success: {
    border: "border-emerald-300",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    text: "text-emerald-900 dark:text-emerald-200",
    Icon: CheckCircle2,
  },
  warning: {
    border: "border-amber-300",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    text: "text-amber-900 dark:text-amber-200",
    Icon: AlertTriangle,
  },
  info: {
    border: "border-[#2C3E50]/30",
    bg: "bg-[#E8EDF2] dark:bg-[#2C3E50]/20",
    text: "text-[#2C3E50] dark:text-[#E8EDF2]",
    Icon: Info,
  },
  error: {
    border: "border-red-300",
    bg: "bg-red-50 dark:bg-red-950/30",
    text: "text-red-900 dark:text-red-200",
    Icon: XCircle,
  },
};

export const AiStatusCallout = ({
  tone,
  title,
  children,
}: {
  tone: CalloutTone;
  title: string;
  children?: React.ReactNode;
}) => {
  const { border, bg, text, Icon } = toneStyles[tone];

  return (
    <div
      className={`rounded-2xl border ${border} ${bg} px-4 py-4 text-sm ${text}`}
    >
      <div className="flex items-center gap-2 font-medium">
        <Icon className="size-4 shrink-0" />
        {title}
      </div>
      {children ? <div className="mt-2">{children}</div> : null}
    </div>
  );
};
