import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";

export function NoshoAIAssist() {
  return (
    <Card className="p-4 shadow-sm border-border/50 bg-gradient-to-br from-[var(--nosho-orange)]/5 to-[var(--nosho-green)]/5">
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--nosho-orange)] to-[var(--nosho-green)] shrink-0">
          <Sparkles className="w-4.5 h-4.5 text-white" />
        </div>
        <div className="flex flex-col gap-1.5 min-w-0">
          <h3 className="text-sm font-semibold text-foreground">
            Nosho AI Assist
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Améliorez votre suivi client avec des suggestions intelligentes
            basées sur vos interactions récentes.
          </p>
          <button
            type="button"
            className="mt-1 self-start text-xs font-medium px-3 py-1.5 rounded-lg bg-[var(--nosho-green)]/15 text-[var(--nosho-green-dark)] hover:bg-[var(--nosho-green)]/25 transition-colors cursor-pointer"
          >
            Analyser mes contacts
          </button>
        </div>
      </div>
    </Card>
  );
}
