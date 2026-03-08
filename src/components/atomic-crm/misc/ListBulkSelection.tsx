import type { ReactNode } from "react";
import { useListContext, type Identifier } from "ra-core";
import { Checkbox } from "@/components/ui/checkbox";
import { BulkActionsToolbar } from "@/components/admin/bulk-actions-toolbar";
import { BulkExportButton } from "@/components/admin/bulk-export-button";
import { BulkDeleteButton } from "@/components/admin/bulk-delete-button";
import { SelectAllButton } from "@/components/admin/select-all-button";
import { cn } from "@/lib/utils";

/**
 * Checkbox for the table header — toggles all visible rows on the current page.
 */
export const ListSelectAllCheckbox = () => {
  const { data, selectedIds, onSelect, onUnselectItems } = useListContext();
  const allIds = data?.map((r) => r.id) ?? [];
  const allSelected =
    allIds.length > 0 && allIds.every((id) => selectedIds.includes(id));
  const someSelected =
    !allSelected && allIds.some((id) => selectedIds.includes(id));

  return (
    <Checkbox
      checked={allSelected ? true : someSelected ? "indeterminate" : false}
      onCheckedChange={(checked) => {
        if (checked) {
          const merged = [...new Set([...selectedIds, ...allIds])];
          onSelect(merged);
        } else {
          onUnselectItems();
        }
      }}
      aria-label="Seleziona tutti"
      className="translate-y-[2px]"
    />
  );
};

/**
 * Checkbox for a single table row.
 */
export const ListRowCheckbox = ({ id }: { id: Identifier }) => {
  const { selectedIds, onToggleItem } = useListContext();
  return (
    <Checkbox
      checked={selectedIds.includes(id)}
      onCheckedChange={() => onToggleItem(id)}
      onClick={(e) => e.stopPropagation()}
      aria-label="Seleziona riga"
    />
  );
};

/**
 * Checkbox overlay for mobile cards.
 * Wraps a card and adds a checkbox on the left without breaking the Link navigation.
 */
export const MobileSelectableCard = ({
  id,
  children,
}: {
  id: Identifier;
  children: ReactNode;
}) => {
  const { selectedIds, onToggleItem } = useListContext();
  const isSelected = selectedIds.includes(id);

  return (
    <div className={cn("flex items-start gap-2", isSelected && "bg-primary/5")}>
      <div className="pt-4 pl-1 shrink-0">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleItem(id)}
          aria-label="Seleziona"
        />
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
};

/**
 * Pre-configured bulk actions toolbar with export + delete.
 */
export const ListBulkToolbar = ({
  allowDelete = false,
}: {
  allowDelete?: boolean;
}) => (
  <BulkActionsToolbar>
    <SelectAllButton />
    <BulkExportButton />
    {allowDelete && <BulkDeleteButton />}
  </BulkActionsToolbar>
);
