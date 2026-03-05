import type { LucideIcon } from "lucide-react";
import {
  Video,
  Scissors,
  Camera,
  Mic,
  FileText,
  Briefcase,
} from "lucide-react";

export const serviceTypeStyles: Record<
  string,
  { icon: LucideIcon; text: string; bg: string }
> = {
  riprese: { icon: Video, text: "text-blue-600", bg: "bg-blue-50" },
  montaggio: { icon: Scissors, text: "text-purple-600", bg: "bg-purple-50" },
  fotografia: { icon: Camera, text: "text-pink-600", bg: "bg-pink-50" },
  audio: { icon: Mic, text: "text-amber-600", bg: "bg-amber-50" },
  documentazione: { icon: FileText, text: "text-green-600", bg: "bg-green-50" },
  altro: { icon: Briefcase, text: "text-slate-600", bg: "bg-slate-50" },
};

export const defaultServiceTypeStyle = serviceTypeStyles.altro;
