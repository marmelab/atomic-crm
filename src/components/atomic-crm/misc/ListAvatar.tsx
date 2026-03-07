import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CLOUDINARY_CLOUD_NAME } from "@/lib/cloudinary/cloudinaryConfig";

interface ListAvatarProps {
  imageUrl?: string | null;
  icon: LucideIcon;
  iconColor?: string;
  bgClass?: string;
  alt?: string;
}

/**
 * Avatar for list rows: shows Cloudinary image when available,
 * falls back to an icon badge.
 */
export function ListAvatar({
  imageUrl,
  icon: Icon,
  iconColor = "text-gray-500",
  bgClass = "bg-gray-50 border-gray-200",
  alt = "",
}: ListAvatarProps) {
  if (imageUrl) {
    const src = getAvatarUrl(imageUrl);
    return (
      <img
        src={src}
        alt={alt}
        className="shrink-0 size-10 rounded-lg object-cover border"
        loading="lazy"
      />
    );
  }

  return (
    <div
      className={cn(
        "shrink-0 size-10 rounded-lg border flex items-center justify-center",
        bgClass,
      )}
    >
      <Icon className={cn("size-5", iconColor)} />
    </div>
  );
}

function getAvatarUrl(url: string): string {
  const cloudBase = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/`;
  if (!url.includes(cloudBase)) return url;
  const afterUpload = url.split("/upload/").slice(1).join("/upload/");
  const displayTransform = "w_80,h_80,c_fill,g_auto,r_8,q_auto,f_auto";

  // Preserve existing transforms (e.g. c_crop) before the display transform
  const versionMatch = afterUpload.match(/^(.*?)(v\d+\/.*)$/);
  if (versionMatch) {
    const [, existingTransforms, rest] = versionMatch;
    return `${cloudBase}${existingTransforms}${displayTransform}/${rest}`;
  }
  return `${cloudBase}${displayTransform}/${afterUpload}`;
}
