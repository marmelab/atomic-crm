import { MessageSquarePlus, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";

import { FeedbackPanel } from "./FeedbackPanel";

/**
 * Flytande feedback-widget (chatt-liknande bubbla nere till höger).
 * Delad teaminkorg för feedback om CRM:t självt.
 *
 * Renderas inte i demo-läge eftersom feedback_items-tabellen inte finns
 * i FakeRest-providern (skulle annars fela vid getList/create).
 */
export const FloatingFeedbackWidget = () => {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  if (import.meta.env.VITE_IS_DEMO === "true") {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          aria-label="Öppna feedback"
          className={`fixed right-4 z-50 h-14 w-14 cursor-pointer rounded-full shadow-lg ${
            // På mobil ligger en bottennavigering — placera bubblan ovanför den.
            isMobile
              ? "bottom-[calc(var(--crm-mobile-nav-height,4rem)+1rem)]"
              : "bottom-6 right-6"
          }`}
        >
          {open ? (
            <X className="h-6 w-6" />
          ) : (
            <MessageSquarePlus className="h-6 w-6" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="top"
        sideOffset={12}
        className="z-50 flex h-[32rem] max-h-[70dvh] w-96 max-w-[calc(100vw-2rem)] flex-col p-0"
      >
        <FeedbackPanel open={open} />
      </PopoverContent>
    </Popover>
  );
};
