import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CHANGELOG } from "../../../changelog";

const TYPE_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  feat: { label: "Nouveauté", variant: "default" },
  fix: { label: "Correction", variant: "secondary" },
  chore: { label: "Interne", variant: "outline" },
};

export const ChangelogModal = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => (
  <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
    <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Notes de version</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-6 pt-2">
        {CHANGELOG.map((entry, i) => (
          <div key={entry.version}>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="font-semibold text-base">{entry.version}</span>
              <span className="text-xs text-muted-foreground">{entry.date}</span>
              {i === 0 && (
                <Badge variant="default" className="text-[10px] px-1.5 py-0 ml-1">
                  Actuelle
                </Badge>
              )}
            </div>
            <ul className="flex flex-col gap-2">
              {entry.changes.map((change, j) => {
                const { label, variant } = TYPE_LABELS[change.type] ?? TYPE_LABELS.chore;
                return (
                  <li key={j} className="flex items-start gap-2 text-sm">
                    <Badge variant={variant} className="text-[10px] px-1.5 py-0 mt-0.5 shrink-0">
                      {label}
                    </Badge>
                    <span>{change.label}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </DialogContent>
  </Dialog>
);
