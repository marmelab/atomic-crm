import { Building2, Columns3, List, type LucideIcon } from "lucide-react";
import { useListContext, useStore } from "ra-core";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DealViewMode = "kanban" | "list" | "company";

/**
 * React Admin store key persisting the selected view, so the preference
 * survives reloads and is restored per user.
 */
export const DEAL_VIEW_STORE_KEY = "deals.viewMode";

const VIEW_OPTIONS: {
  mode: DealViewMode;
  label: string;
  icon: LucideIcon;
}[] = [
  { mode: "kanban", label: "Kanban", icon: Columns3 },
  { mode: "list", label: "List", icon: List },
  { mode: "company", label: "By company", icon: Building2 },
];

/**
 * Segmented Kanban / List / By company toggle for the Deals page toolbar.
 *
 * The selection is persisted in the React Admin store and breaks no list
 * state: filters, search, sort and pagination are owned by the shared List
 * context, so switching views keeps the current search terms and filters.
 */
export const DealViewToggle = () => {
  const [viewMode, setViewMode] = useStore<DealViewMode>(
    DEAL_VIEW_STORE_KEY,
    "kanban",
  );
  // Resetting the page when going back to the board keeps it consistent:
  // the Kanban reads its stage columns from the same (already filtered)
  // records as the list view.
  const { setPage } = useListContext();

  return (
    <div
      role="radiogroup"
      aria-label="Deals view"
      className="inline-flex items-center rounded-md border bg-background p-0.5"
    >
      {VIEW_OPTIONS.map(({ mode, label, icon: Icon }) => {
        const isSelected = viewMode === mode;
        return (
          <Button
            key={mode}
            type="button"
            role="radio"
            aria-checked={isSelected}
            variant={isSelected ? "secondary" : "ghost"}
            size="sm"
            className={cn(
              "h-7 gap-1.5 px-2 cursor-pointer",
              !isSelected && "text-muted-foreground",
            )}
            onClick={() => {
              if (!isSelected) {
                setViewMode(mode);
                if (mode === "kanban") setPage(1);
              }
            }}
            title={label}
          >
            <Icon />
            <span className="hidden sm:inline">{label}</span>
          </Button>
        );
      })}
    </div>
  );
};
