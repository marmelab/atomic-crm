import { useCallback, useEffect, useRef } from "react";
import {
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
} from "@/lib/cloudinary/cloudinaryConfig";
import type {
  CloudinaryAssetRef,
  CloudinaryMediaLibraryAsset,
} from "@/lib/cloudinary/cloudinaryTypes";

export interface UseCloudinaryMediaLibraryOptions {
  /** Allow selecting multiple assets. Default: false. */
  multiple?: boolean;
  /** Max selectable assets (only when multiple=true). Default: 10. */
  maxFiles?: number;
  /** Filter by folder path (e.g. "crm/clients"). */
  folder?: string;
  /** Called with selected asset(s). */
  onInsert: (assets: CloudinaryAssetRef[]) => void;
}

/**
 * Opens the Cloudinary Media Library widget to browse and select existing assets.
 *
 * Returns `open()` — call it from a button onClick.
 *
 * Requires the Media Library Widget script in index.html.
 */
export function useCloudinaryMediaLibrary({
  multiple = false,
  maxFiles = 10,
  folder,
  onInsert,
}: UseCloudinaryMediaLibraryOptions) {
  const mlRef = useRef<ReturnType<
    NonNullable<Window["cloudinary"]>["createMediaLibrary"]
  > | null>(null);

  useEffect(() => {
    return () => {
      mlRef.current?.destroy();
    };
  }, []);

  const open = useCallback(() => {
    if (!window.cloudinary) {
      console.error("Cloudinary Media Library Widget script not loaded");
      return;
    }

    // Destroy previous instance if any
    mlRef.current?.destroy();

    const ml = window.cloudinary.createMediaLibrary(
      {
        cloud_name: CLOUDINARY_CLOUD_NAME,
        api_key: CLOUDINARY_API_KEY,
        multiple,
        max_files: maxFiles,
        folder: folder ? { path: folder } : undefined,
      },
      {
        insertHandler: (data: { assets: CloudinaryMediaLibraryAsset[] }) => {
          const refs: CloudinaryAssetRef[] = data.assets.map((asset) => ({
            public_id: asset.public_id,
            secure_url: asset.secure_url,
            resource_type: asset.resource_type,
            format: asset.format,
          }));
          onInsert(refs);
        },
      },
    );

    mlRef.current = ml;
    ml.show();
  }, [multiple, maxFiles, folder, onInsert]);

  return { open };
}
