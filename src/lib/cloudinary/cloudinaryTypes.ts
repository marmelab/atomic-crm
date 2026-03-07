/** Result returned by the Upload Widget after a successful upload. */
export interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  url: string;
  resource_type: "image" | "video" | "raw" | "auto";
  format: string;
  bytes: number;
  width?: number;
  height?: number;
  original_filename: string;
  asset_id: string;
  created_at: string;
}

/** Asset selected from the Media Library Widget. */
export interface CloudinaryMediaLibraryAsset {
  public_id: string;
  secure_url: string;
  url: string;
  resource_type: "image" | "video" | "raw";
  format: string;
  bytes: number;
  width?: number;
  height?: number;
  created_at: string;
  derived?: Array<{ secure_url: string; url: string }>;
}

/** Minimal reference stored in the DB for an attached Cloudinary asset. */
export interface CloudinaryAssetRef {
  public_id: string;
  secure_url: string;
  resource_type: "image" | "video" | "raw";
  format: string;
  original_filename?: string;
}

/** Augment the global Window for Cloudinary widget scripts. */
declare global {
  interface Window {
    cloudinary?: {
      createUploadWidget: (
        options: Record<string, unknown>,
        callback: (
          error: Error | null,
          result: { event: string; info: CloudinaryUploadResult },
        ) => void,
      ) => { open: () => void; close: () => void; destroy: () => void };
      createMediaLibrary: (
        options: Record<string, unknown>,
        insertHandler: { insertHandler: (data: { assets: CloudinaryMediaLibraryAsset[] }) => void },
      ) => { show: () => void; hide: () => void; destroy: () => void };
      openMediaLibrary: (
        options: Record<string, unknown>,
        insertHandler: { insertHandler: (data: { assets: CloudinaryMediaLibraryAsset[] }) => void },
      ) => void;
    };
  }
}
