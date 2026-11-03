import { X } from "lucide-react";
import { useTranslate } from "ra-core";
import { cn } from "@/lib/utils";

/**
 * Renders the "clear value" button overlaid on the right of select-like inputs.
 *
 * @internal
 */
export function ClearInputButton({
  className,
  onClick,
}: {
  className?: string;
  onClick: () => void;
}) {
  const translate = useTranslate();
  return (
    <button
      type="button"
      aria-label={translate("ra.action.clear_input_value")}
      className={cn(
        "absolute top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground opacity-50 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        className,
      )}
      onClick={onClick}
    >
      <X className="h-4 w-4" />
    </button>
  );
}
