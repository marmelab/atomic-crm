import { useState } from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { FeedbackInputBar } from "./FeedbackInputBar";
import { FeedbackThread } from "./FeedbackThread";
import { useGetFeedback } from "./useGetFeedback";

type StatusView = "open" | "all";

export const FeedbackPanel = ({ open }: { open: boolean }) => {
  const [view, setView] = useState<StatusView>("open");

  const { data, isPending, refetch } = useGetFeedback(
    open,
    view === "open" ? "open" : undefined,
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div>
          <h2 className="text-sm font-semibold">Feedback</h2>
          <p className="text-[11px] text-muted-foreground">
            Vad funkar, vad är trasigt, vad saknas?
          </p>
        </div>
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(value) => value && setView(value as StatusView)}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="open" className="h-7 px-2 text-xs">
            Öppna
          </ToggleGroupItem>
          <ToggleGroupItem value="all" className="h-7 px-2 text-xs">
            Alla
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <FeedbackThread items={data ?? []} isPending={isPending} />

      <FeedbackInputBar onCreated={() => refetch()} />
    </div>
  );
};
