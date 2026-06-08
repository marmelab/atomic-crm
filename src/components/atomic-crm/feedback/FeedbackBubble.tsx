import { Check } from "lucide-react";
import { useGetIdentity, useUpdate } from "ra-core";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { RelativeDate } from "../misc/RelativeDate";
import type { FeedbackItem } from "../types";
import { FeedbackAuthor } from "./FeedbackAuthor";
import { getFeedbackCategory } from "./feedbackCategories";

export const FeedbackBubble = ({ item }: { item: FeedbackItem }) => {
  const { identity } = useGetIdentity();
  const isCurrentUser = item.sales_id === identity?.id;
  const category = getFeedbackCategory(item.category);
  const isDone = item.status === "done";

  const [update, { isPending }] = useUpdate();

  const toggleDone = () => {
    update(
      "feedback_items",
      {
        id: item.id,
        data: { status: isDone ? "open" : "done" },
        previousData: item,
      },
      { mutationMode: "optimistic" },
    );
  };

  return (
    <div
      className={cn(
        "rounded-lg border p-3 text-sm transition-opacity",
        isDone && "opacity-60",
      )}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <FeedbackAuthor salesId={item.sales_id} isCurrentUser={isCurrentUser} />
        <span className="text-xs text-muted-foreground">
          <RelativeDate date={item.created_at} />
        </span>
      </div>

      <div className="flex items-start gap-2">
        {category && (
          <span
            className={cn(
              "mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs",
              category.badgeClassName,
            )}
            title={category.label}
          >
            {category.emoji}
          </span>
        )}
        <p
          className={cn(
            "flex-1 whitespace-pre-wrap break-words",
            isDone && "line-through",
          )}
        >
          {item.text}
        </p>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isDone ? "secondary" : "ghost"}
                size="sm"
                onClick={toggleDone}
                disabled={isPending}
                aria-label={isDone ? "Markera som öppen" : "Markera som klar"}
                className="h-7 w-7 shrink-0 cursor-pointer p-0"
              >
                <Check className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isDone ? "Markera som öppen" : "Markera som klar"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {item.page_context && (
        <p className="mt-1.5 truncate text-[11px] text-muted-foreground">
          📍 {item.page_context}
        </p>
      )}
    </div>
  );
};
