import { useRef } from "react";
import { EllipsisVertical, Paperclip, Trash2 } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { useTranslate } from "ra-core";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const NoteMenuButton = ({ onDelete }: { onDelete?: () => void }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { getValues, setValue } = useFormContext();
  const translate = useTranslate();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const newFiles = Array.from(fileList).map((file) => ({
      rawFile: file,
      src: URL.createObjectURL(file),
      title: file.name,
    }));

    const existing = getValues("attachments") || [];
    const currentFiles = Array.isArray(existing) ? existing : [existing];
    setValue("attachments", [...currentFiles, ...newFiles], {
      shouldDirty: true,
    });

    e.target.value = "";
  };

  return (
    <>
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
            className="h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
            onSelect={() => inputRef.current?.click()}
          >
            <Paperclip />
            {translate("resources.notes.actions.attach_document", {
              _: "Attach document",
            })}
          </DropdownMenuItem>
          {onDelete && (
            <DropdownMenuItem
              variant="destructive"
              className="h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
              onSelect={onDelete}
            >
              <Trash2 />
              {translate("ra.action.delete")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
    </>
  );
};
