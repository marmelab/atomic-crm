import { Sparkles } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAssist } from "./assistStore";

export function NoshoAssistFAB() {
  const { open, isOpen } = useAssist();

  if (isOpen) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Aide & feedback"
          onClick={() => open()}
          className="fixed bottom-6 right-6 z-[60] w-12 h-12 rounded-full bg-gradient-to-br from-[var(--nosho-orange)] to-[var(--nosho-green)] shadow-lg shadow-black/20 hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center cursor-pointer ring-2 ring-white/20"
        >
          <Sparkles className="w-5 h-5 text-white" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left">Aide & feedback</TooltipContent>
    </Tooltip>
  );
}
