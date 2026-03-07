import { Upload, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCloudinaryUpload } from "@/hooks/useCloudinaryUpload";
import { useCloudinaryMediaLibrary } from "@/hooks/useCloudinaryMediaLibrary";
import type { CloudinaryAssetRef } from "@/lib/cloudinary/cloudinaryTypes";

export interface CloudinaryMediaButtonProps {
  /** Cloudinary unsigned upload preset. Default: "Gestionale". */
  uploadPreset?: string;
  /** Folder on Cloudinary for uploads (e.g. "crm/clients/123"). */
  folder?: string;
  /** Called when an asset is uploaded or selected from the library. */
  onSelect: (asset: CloudinaryAssetRef) => void;
  /** Button label. Default: "Media". */
  label?: string;
  /** Button variant. */
  variant?: "default" | "outline" | "ghost" | "secondary";
  /** Button size. */
  size?: "default" | "sm" | "lg" | "icon";
}

/**
 * Dropdown button with two options:
 * 1. Upload — opens the Cloudinary Upload Widget
 * 2. Libreria — opens the Cloudinary Media Library to browse existing assets
 */
export function CloudinaryMediaButton({
  uploadPreset = "Gestionale",
  folder,
  onSelect,
  label = "Media",
  variant = "outline",
  size = "default",
}: CloudinaryMediaButtonProps) {
  const { open: openUpload } = useCloudinaryUpload({
    uploadPreset,
    folder,
    onUpload: onSelect,
  });

  const { open: openLibrary } = useCloudinaryMediaLibrary({
    folder,
    onInsert: (assets) => {
      if (assets.length > 0) {
        onSelect(assets[0]);
      }
    },
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size}>
          <ImageIcon className="mr-2 h-4 w-4" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={openUpload}>
          <Upload className="mr-2 h-4 w-4" />
          Carica nuovo
        </DropdownMenuItem>
        <DropdownMenuItem onClick={openLibrary}>
          <ImageIcon className="mr-2 h-4 w-4" />
          Libreria media
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
