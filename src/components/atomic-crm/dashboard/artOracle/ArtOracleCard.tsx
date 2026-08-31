import { useState } from "react";
import { useTranslate } from "ra-core";

import { Card, CardContent } from "@/components/ui/card";
import { ArtworkLightbox } from "./ArtworkLightbox";
import { useDailyArtwork } from "./useDailyArtwork";

// A small piece of beauty/soul, not another operational widget — kept
// deliberately compact so it doesn't compete with Tasks or capacity. Never
// throws: a failed image load just fails silently instead of breaking the
// Dashboard (onError hides the <img>).
export const ArtOracleCard = () => {
  const translate = useTranslate();
  const { artwork } = useDailyArtwork();
  const [open, setOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-xl font-semibold">
        {translate("crm.dashboard.art_oracle_title", { _: "Art Oracle" })}
      </h2>
      <Card className="p-0 overflow-hidden">
        <CardContent className="p-0">
          {!imageFailed && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="block w-full cursor-pointer bg-neutral-900 dark:bg-black"
              aria-label={artwork.title}
            >
              <img
                src={artwork.image_url}
                alt={artwork.title}
                onError={() => setImageFailed(true)}
                className="w-full h-72 sm:h-80 object-contain"
              />
            </button>
          )}
          <div className="p-3 flex flex-col gap-0.5">
            <p className="text-sm font-medium truncate">{artwork.title}</p>
            <p className="text-xs text-muted-foreground truncate">
              {artwork.artist_or_maker}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {artwork.culture_or_region}
              {artwork.date ? ` · ${artwork.date}` : ""}
            </p>
          </div>
        </CardContent>
      </Card>
      <ArtworkLightbox artwork={artwork} open={open} onOpenChange={setOpen} />
    </div>
  );
};
