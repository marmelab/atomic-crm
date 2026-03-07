import { useCallback, useEffect, useRef } from "react";
import {
  CLOUDINARY_CLOUD_NAME,
} from "@/lib/cloudinary/cloudinaryConfig";
import type {
  CloudinaryAssetRef,
  CloudinaryUploadResult,
} from "@/lib/cloudinary/cloudinaryTypes";

export interface UseCloudinaryUploadOptions {
  /** Cloudinary unsigned upload preset (create one in Settings > Upload). */
  uploadPreset: string;
  /** Folder path on Cloudinary (e.g. "crm/clients"). */
  folder?: string;
  /** Allowed resource types. Default: ["image", "video", "raw"]. */
  resourceType?: "image" | "video" | "raw" | "auto";
  /** Max file size in bytes. */
  maxFileSize?: number;
  /** Enable interactive cropping before upload. */
  cropping?: boolean;
  /** Crop aspect ratio (e.g. 1 for square). Only used when cropping is true. */
  croppingAspectRatio?: number;
  /** Called with the asset ref after a successful upload. */
  onUpload: (asset: CloudinaryAssetRef) => void;
}

/**
 * Opens the Cloudinary Upload Widget.
 *
 * Returns `open()` — call it from a button onClick.
 *
 * Requires the Upload Widget script in index.html.
 */
export function useCloudinaryUpload({
  uploadPreset,
  folder,
  resourceType = "auto",
  maxFileSize,
  cropping = false,
  croppingAspectRatio,
  onUpload,
}: UseCloudinaryUploadOptions) {
  const widgetRef = useRef<ReturnType<
    NonNullable<Window["cloudinary"]>["createUploadWidget"]
  > | null>(null);

  useEffect(() => {
    return () => {
      widgetRef.current?.destroy();
    };
  }, []);

  const open = useCallback(() => {
    if (!window.cloudinary) {
      console.error("Cloudinary Upload Widget script not loaded");
      return;
    }

    // Destroy previous instance if any
    widgetRef.current?.destroy();

    const widget = window.cloudinary.createUploadWidget(
      {
        cloudName: CLOUDINARY_CLOUD_NAME,
        uploadPreset,
        folder,
        resourceType,
        maxFileSize,
        sources: [
          "local",
          "url",
          "camera",
          "google_drive",
          "dropbox",
        ],
        multiple: false,
        showAdvancedOptions: false,
        cropping,
        ...(cropping && croppingAspectRatio != null
          ? { croppingAspectRatio }
          : {}),
        styles: {
          palette: {
            window: "#FFFFFF",
            windowBorder: "#90A0B3",
            tabIcon: "#0078FF",
            menuIcons: "#5A616A",
            textDark: "#000000",
            textLight: "#FFFFFF",
            link: "#0078FF",
            action: "#FF620C",
            inactiveTabIcon: "#0E2F5A",
            error: "#F44235",
            inProgress: "#0078FF",
            complete: "#20B832",
            sourceBg: "#E4EBF1",
          },
        },
      },
      (error: Error | null, result: { event: string; info: CloudinaryUploadResult }) => {
        if (error) {
          console.error("Cloudinary upload error:", error);
          return;
        }
        if (result.event === "success") {
          const info = result.info;
          let url = info.secure_url;

          // Apply crop coordinates to the URL when the user cropped
          const cropCoords = info.coordinates?.custom?.[0];
          if (cropCoords && url.includes("/upload/")) {
            const [x, y, w, h] = cropCoords;
            const cropTransform = `c_crop,x_${x},y_${y},w_${w},h_${h}`;
            url = url.replace("/upload/", `/upload/${cropTransform}/`);
          }

          onUpload({
            public_id: info.public_id,
            secure_url: url,
            resource_type: info.resource_type === "auto" ? "raw" : info.resource_type,
            format: info.format,
            original_filename: info.original_filename,
          });
        }
      },
    );

    widgetRef.current = widget;
    widget.open();
  }, [uploadPreset, folder, resourceType, maxFileSize, cropping, croppingAspectRatio, onUpload]);

  return { open };
}
