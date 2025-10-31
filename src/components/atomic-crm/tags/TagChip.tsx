import { X } from "lucide-react";
import { useState } from "react";

import type { Tag } from "../types";
import { TagEditModal } from "./TagEditModal";

type TagChipProps = {
  tag: Tag;

  onUnlink: () => Promise<void>;
};

export function TagChip({ tag, onUnlink }: TagChipProps) {
  const [open, setOpen] = useState(false);

  const handleClose = () => {
    setOpen(false);
  };

  const handleClick = () => {
    setOpen(true);
  };

  return (
    <>
      <div
        className="text-black inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md cursor-pointer hover:opacity-80 transition-opacity"
        style={{ backgroundColor: tag.color }}
        onClick={handleClick}
      >
        {tag.name}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onUnlink();
          }}
          className="transition-colors p-0 ml-1 cursor-pointer"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      <TagEditModal tag={tag} open={open} onClose={handleClose} />
    </>
  );
}
