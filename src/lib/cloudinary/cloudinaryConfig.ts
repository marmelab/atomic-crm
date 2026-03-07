import { Cloudinary } from "@cloudinary/url-gen";

export const CLOUDINARY_CLOUD_NAME =
  import.meta.env.VITE_CLOUDINARY_CLOUD_NAME ?? "";
export const CLOUDINARY_API_KEY =
  import.meta.env.VITE_CLOUDINARY_API_KEY ?? "";

/**
 * Shared Cloudinary instance for URL generation and transformations.
 */
export const cld = new Cloudinary({
  cloud: { cloudName: CLOUDINARY_CLOUD_NAME },
});
