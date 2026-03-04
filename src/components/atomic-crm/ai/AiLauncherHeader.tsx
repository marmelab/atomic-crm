import { ArrowLeft, Bot, Check, Copy, RotateCcw } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export type UnifiedAiLauncherView = "chat" | "snapshot" | "import";

const viewTitles: Record<UnifiedAiLauncherView, string> = {
  chat: "Chat AI",
  snapshot: "Snapshot CRM",
  import: "Importa fatture e ricevute",
};

export const AiLauncherHeader = ({
  activeView,
  onViewChange,
  canResetChat,
  onResetChat,
  canCopyAnswer,
  answerMarkdown,
}: {
  activeView: UnifiedAiLauncherView;
  onViewChange: (view: UnifiedAiLauncherView) => void;
  canResetChat?: boolean;
  onResetChat?: () => void;
  canCopyAnswer?: boolean;
  answerMarkdown?: string;
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!answerMarkdown) return;
    await navigator.clipboard.writeText(answerMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <SheetHeader className="border-b bg-background/95 pb-2 pr-14">
      {activeView === "chat" ? (
        <div className="flex items-center gap-2 text-left">
          <Bot className="size-4" />
          <SheetTitle>{viewTitles.chat}</SheetTitle>
          <div className="ml-auto flex items-center gap-1">
            {canCopyAnswer ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground"
                onClick={handleCopy}
                aria-label="Copia risposta"
              >
                {copied ? (
                  <Check className="size-3.5" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </Button>
            ) : null}
            {canResetChat ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1 px-2 text-xs"
                onClick={onResetChat}
                aria-label="Resetta chat AI"
              >
                <RotateCcw className="size-3.5" />
                Nuova
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-left">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="-ml-2"
            onClick={() => onViewChange("chat")}
            aria-label="Torna alla chat AI"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <SheetTitle>{viewTitles[activeView]}</SheetTitle>
        </div>
      )}
      <SheetDescription className="sr-only">
        Chat AI unificata con viste per chat CRM, snapshot e import fatture.
      </SheetDescription>
    </SheetHeader>
  );
};
