import { EllipsisVertical, Trash2 } from "lucide-react";
import { useTranslate } from "ra-core";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const ContactMenuButton = ({ onDelete }: { onDelete: () => void }) => {
  const translate = useTranslate();

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="opacity-70 transition-opacity hover:opacity-100 rounded-xs"
        >
          <EllipsisVertical className="size-6" />
          <span className="sr-only">
            {translate("ra.action.open_menu", { _: "More" })}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          variant="destructive"
          className="h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
          onSelect={onDelete}
        >
          <Trash2 />
          {translate("ra.action.delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
