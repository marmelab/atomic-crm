import { ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CLOUDINARY_CLOUD_NAME } from "@/lib/cloudinary/cloudinaryConfig";

interface CloudinaryImageFieldProps {
  url: string | null | undefined;
  alt?: string;
  /** Display mode: "avatar" (circle 48px), "thumbnail" (rect 200px), "proof" (rect full-width) */
  mode?: "avatar" | "thumbnail" | "proof";
  onRemove?: () => void;
}

/**
 * Renders a Cloudinary image with on-the-fly transformations.
 * If the URL is a Cloudinary URL, it injects optimized transforms.
 * If not, it renders the raw URL as-is.
 */
export function CloudinaryImageField({
  url,
  alt = "Media",
  mode = "thumbnail",
  onRemove,
}: CloudinaryImageFieldProps) {
  if (!url) return null;

  const optimizedUrl = getOptimizedUrl(url, mode);
  const sizeClasses = getSizeClasses(mode);

  return (
    <div className="relative inline-block group">
      <a href={url} target="_blank" rel="noopener noreferrer">
        <img
          src={optimizedUrl}
          alt={alt}
          className={`object-cover ${sizeClasses}`}
          loading="lazy"
        />
        <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/30 transition-opacity rounded-inherit">
          <ExternalLink className="size-4 text-white" />
        </span>
      </a>
      {onRemove && (
        <Button
          type="button"
          variant="destructive"
          size="icon"
          className="absolute -top-2 -right-2 size-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
        >
          <X className="size-3" />
        </Button>
      )}
    </div>
  );
}

function getOptimizedUrl(url: string, mode: string): string {
  const cloudBase = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/`;
  if (!url.includes(cloudBase)) return url;

  const afterUpload = url.split("/upload/").slice(1).join("/upload/");
  const transforms: Record<string, string> = {
    avatar: "w_96,h_96,c_fill,r_max,q_auto,f_auto",
    thumbnail: "w_400,h_300,c_fill,q_auto,f_auto",
    proof: "w_800,q_auto,f_auto",
  };
  const t = transforms[mode] ?? transforms.thumbnail;
  return `${cloudBase}${t}/${afterUpload}`;
}

function getSizeClasses(mode: string): string {
  switch (mode) {
    case "avatar":
      return "size-12 rounded-full";
    case "proof":
      return "w-full max-w-md rounded-lg";
    default:
      return "w-48 h-36 rounded-lg";
  }
}
