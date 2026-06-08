import { SendHorizonal } from "lucide-react";
import { useCreate, useNotify } from "ra-core";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import type { FeedbackCategory } from "../types";
import { FEEDBACK_CATEGORIES } from "./feedbackCategories";

export const FeedbackInputBar = ({ onCreated }: { onCreated: () => void }) => {
  const [create, { isPending }] = useCreate();
  const notify = useNotify();
  const [text, setText] = useState("");
  const [category, setCategory] = useState<FeedbackCategory>("works");

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    create(
      "feedback_items",
      {
        // Skicka INTE sales_id — det fylls av DB-triggern (set_sales_id_default).
        data: {
          text: trimmed,
          category,
          status: "open",
          page_context: window.location.pathname,
        },
      },
      {
        onSuccess: () => {
          setText("");
          onCreated();
        },
        onError: () => notify("Kunde inte spara feedback", { type: "error" }),
      },
    );
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter skickar, Shift+Enter ger radbrytning.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t p-3">
      <ToggleGroup
        type="single"
        value={category}
        onValueChange={(value) =>
          value && setCategory(value as FeedbackCategory)
        }
        variant="outline"
        className="mb-2 w-full"
      >
        {FEEDBACK_CATEGORIES.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            className="h-8 flex-1 gap-1 text-xs"
          >
            <span>{option.emoji}</span>
            <span className="hidden sm:inline">{option.label}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <div className="flex items-end gap-2">
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Skriv feedback…"
          rows={2}
          className="max-h-32 min-h-9 flex-1 resize-none text-sm"
        />
        <Button
          onClick={handleSend}
          disabled={isPending || !text.trim()}
          size="sm"
          aria-label="Skicka feedback"
          className="h-9 w-9 shrink-0 cursor-pointer p-0"
        >
          <SendHorizonal className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
