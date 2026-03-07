import { Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { ColumnDef } from "./columnDefinitions";

export const ColumnVisibilityButton = ({
  columns,
  visibleKeys,
  toggleColumn,
}: {
  columns: ColumnDef[];
  visibleKeys: string[];
  toggleColumn: (key: string) => void;
}) => (
  <Popover>
    <PopoverTrigger asChild>
      <Button variant="outline" size="icon" className="h-9 w-9">
        <Columns3 className="h-4 w-4" />
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" className="w-48 p-2">
      <p className="text-xs font-medium text-muted-foreground px-2 py-1">
        Colonne visibili
      </p>
      {columns.map((col) => (
        <label
          key={col.key}
          className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-muted cursor-pointer"
        >
          <Checkbox
            checked={visibleKeys.includes(col.key)}
            onCheckedChange={() => toggleColumn(col.key)}
          />
          <Label className="text-sm font-normal cursor-pointer">
            {col.label}
          </Label>
        </label>
      ))}
    </PopoverContent>
  </Popover>
);
