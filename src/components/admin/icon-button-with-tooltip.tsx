import { useTranslate } from "ra-core";
import * as React from "react";
import type { MouseEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * A button with a tooltip that ensures the tooltip is closed on click to avoid ghost tooltips.
 *
 * Prevents ghost tooltips that can appear when the button position changes after interaction.
 * Supports internationalization for the label text.
 *
 * @example
 * // Basic usage with icon and label
 * <IconButtonWithTooltip label="Delete">
 *   <Trash2 />
 * </IconButtonWithTooltip>
 */
export const IconButtonWithTooltip = ({
  label,
  onClick,
  children,
  disabled,
  ...props
}: IconButtonWithTooltipProps) => {
  const translate = useTranslate();
  const [open, setOpen] = React.useState(false);

  const handleClose = () => {
    setOpen(false);
  };

  const handleOpen = () => {
    setOpen(true);
  };

  let translatedLabel = label;
  if (typeof label === "string") {
    translatedLabel = translate(label, { _: label });
  }

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    handleClose();
    onClick?.(event);
  };

  return (
    <TooltipProvider>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={
              typeof translatedLabel === "string" ? translatedLabel : undefined
            }
            onClick={handleClick}
            disabled={disabled}
            onMouseEnter={handleOpen}
            onMouseLeave={handleClose}
            {...props}
          >
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{translatedLabel}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export interface IconButtonWithTooltipProps extends React.ComponentProps<"button"> {
  label: React.ReactNode;
  children: React.ReactNode;
}
