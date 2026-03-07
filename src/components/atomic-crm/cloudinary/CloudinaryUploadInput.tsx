import { useFormContext, useWatch } from "react-hook-form";
import { Upload, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCloudinaryUpload } from "@/hooks/useCloudinaryUpload";
import { useCloudinaryMediaLibrary } from "@/hooks/useCloudinaryMediaLibrary";
import { CloudinaryImageField } from "./CloudinaryImageField";
import type { CloudinaryAssetRef } from "@/lib/cloudinary/cloudinaryTypes";

interface CloudinaryUploadInputProps {
  /** Form field name (e.g. "logo_url", "photo_url", "proof_url"). */
  source: string;
  /** Label above the upload area. */
  label: string;
  /** Cloudinary folder for uploads. */
  folder?: string;
  /** Display mode for preview. */
  mode?: "avatar" | "thumbnail" | "proof";
  /** Upload preset. Default: "Gestionale". */
  uploadPreset?: string;
}

/**
 * Form-integrated Cloudinary upload input.
 * Shows a preview if a URL is set, with upload/library/remove actions.
 */
export function CloudinaryUploadInput({
  source,
  label,
  folder,
  mode = "thumbnail",
  uploadPreset = "Gestionale",
}: CloudinaryUploadInputProps) {
  const { setValue } = useFormContext();
  const currentUrl = useWatch({ name: source }) as string | null | undefined;

  const handleSelect = (asset: CloudinaryAssetRef) => {
    setValue(source, asset.secure_url, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const { open: openUpload } = useCloudinaryUpload({
    uploadPreset,
    folder,
    onUpload: handleSelect,
  });

  const { open: openLibrary } = useCloudinaryMediaLibrary({
    folder,
    onInsert: (assets) => {
      if (assets.length > 0) handleSelect(assets[0]);
    },
  });

  const handleRemove = () => {
    setValue(source, null, { shouldDirty: true, shouldValidate: true });
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-muted-foreground">
        {label}
      </label>
      {currentUrl ? (
        <div className="flex items-start gap-3">
          <CloudinaryImageField
            url={currentUrl}
            alt={label}
            mode={mode}
            onRemove={handleRemove}
          />
        </div>
      ) : (
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={openUpload}>
            <Upload className="mr-1.5 size-3.5" />
            Carica
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openLibrary}
          >
            <ImageIcon className="mr-1.5 size-3.5" />
            Libreria
          </Button>
        </div>
      )}
    </div>
  );
}
