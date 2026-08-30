import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

import type { Artwork } from "./artworks";

export const ArtworkLightbox = ({
  artwork,
  open,
  onOpenChange,
}: {
  artwork: Artwork;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-2xl p-0 overflow-hidden">
      <img
        src={artwork.image_url}
        alt={artwork.title}
        className="w-full max-h-[60vh] object-contain bg-black"
      />
      <div className="p-6 flex flex-col gap-1">
        <DialogTitle className="text-lg font-semibold">
          {artwork.title}
        </DialogTitle>
        <p className="text-sm">{artwork.artist_or_maker}</p>
        <p className="text-sm text-muted-foreground">
          {artwork.culture_or_region}
        </p>
        <p className="text-sm text-muted-foreground">{artwork.date}</p>
        {artwork.medium && (
          <p className="text-sm text-muted-foreground">{artwork.medium}</p>
        )}
        <p className="text-sm text-muted-foreground">{artwork.museum}</p>
        <a
          href={artwork.source_url}
          target="_blank"
          rel="noreferrer"
          className="text-sm underline hover:no-underline mt-2"
        >
          View at the source museum
        </a>
      </div>
    </DialogContent>
  </Dialog>
);
