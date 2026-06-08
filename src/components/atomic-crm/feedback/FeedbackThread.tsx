import { useEffect, useRef } from "react";

import { Spinner } from "@/components/ui/spinner";

import type { FeedbackItem } from "../types";
import { FeedbackBubble } from "./FeedbackBubble";

export const FeedbackThread = ({
  items,
  isPending,
}: {
  items: FeedbackItem[];
  isPending: boolean;
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scrolla till nyaste posten (nederst) när tråden ändras.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [items.length]);

  if (isPending && items.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
        Ingen feedback än. Skriv det första meddelandet 👇
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-2 overflow-y-auto p-3">
      {items.map((item) => (
        <FeedbackBubble key={item.id} item={item} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
};
