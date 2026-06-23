import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CircleHelp } from "lucide-react";

export type MetricExplanationContent = {
  meaning: string;
  impact: string;
  thresholds: string;
  interpretation: string;
  action: string;
};

export function MetricExplanation({
  label,
  content,
}: {
  label: string;
  content: MetricExplanationContent;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground"
          aria-label={`Förklara ${label}`}
        >
          <CircleHelp className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-3 text-sm">
        <div>
          <p className="font-semibold">{label}</p>
          <p className="text-muted-foreground">{content.meaning}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide">
            Varför det spelar roll
          </p>
          <p className="text-muted-foreground">{content.impact}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide">
            Riktvärde
          </p>
          <p className="text-muted-foreground">{content.thresholds}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide">
            Tolkning nu
          </p>
          <p className="text-muted-foreground">{content.interpretation}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide">
            Nästa åtgärd
          </p>
          <p className="text-muted-foreground">{content.action}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
