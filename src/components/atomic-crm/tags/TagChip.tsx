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
  const color = tag.color.replace(
    /^#([\da-f])([\da-f])([\da-f])$/i,
    "#$1$1$2$2$3$3",
  );
  const luminance = [0.2126, 0.7152, 0.0722].reduce((sum, weight, index) => {
    const channel =
      parseInt(color.slice(1 + index * 2, 3 + index * 2), 16) / 255;
    return (
      sum +
      weight *
        (channel <= 0.04045
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4)
    );
  }, 0);

  const handleClose = () => {
    setOpen(false);
  };

  const handleClick = () => {
    setOpen(true);
  };

  return (
    <>
      <div
        className="inline-flex items-center gap-1 px-4 md:px-2 py-2 md:py-1 text-sm md:text-xs rounded-md cursor-pointer hover:opacity-80 transition-opacity"
        style={{
          backgroundColor: tag.color,
          color: luminance <= 0.179 ? "#fff" : "#000",
        }}
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
          <X className="w-4 h-4 md:w-3 md:h-3" />
        </button>
      </div>
      <TagEditModal tag={tag} open={open} onClose={handleClose} />
    </>
  );
}
