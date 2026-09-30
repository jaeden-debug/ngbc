import Image from "next/image";
import type { SpeciesMediaVariant, SpeciesPrimaryMedia } from "../../lib/species-media/types";

export function SpeciesImagePlaceholder({ className, label }: { className?: string; label: string }) {
  return (
    <span className={className} role="img" aria-label={`No photograph set for ${label}`} data-species-placeholder>
      <svg viewBox="0 0 64 64" aria-hidden="true" fill="none">
        <path d="M10 47 25 30l8 8 7-8 14 17H10Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="43" cy="20" r="6" stroke="currentColor" strokeWidth="2" />
        <path d="M16 14h32a7 7 0 0 1 7 7v27a7 7 0 0 1-7 7H16a7 7 0 0 1-7-7V21a7 7 0 0 1 7-7Z" stroke="currentColor" strokeWidth="2" />
      </svg>
    </span>
  );
}

/**
 * "Photo by <photographer> on <provider>", both linked, wherever a credited
 * photograph is shown. Renders nothing for North Ground's own photographs.
 */
export function SpeciesPhotoCredit({ media, className }: { media: SpeciesPrimaryMedia; className?: string }) {
  const { credit } = media;
  if (!credit) return null;
  return (
    <span className={className} data-species-credit>
      Photo by <a href={credit.creatorUrl} target="_blank" rel="noopener noreferrer">{credit.creatorName}</a>
      {" "}on <a href={credit.providerUrl} target="_blank" rel="noopener noreferrer">{credit.providerName}</a>
    </span>
  );
}

export default function SpeciesPrimaryImage({ media, variant, className, loading = "lazy", focal, zoom }: {
  media: SpeciesPrimaryMedia;
  variant: SpeciesMediaVariant;
  className?: string;
  loading?: "eager" | "lazy";
  /** Overrides the stored focal point while an administrator is dragging it. */
  focal?: { x: number; y: number };
  /**
   * Draws the image larger than its box, anchored at the focal point, so a
   * photograph that already fills one axis can still be moved in the other.
   */
  zoom?: number;
}) {
  const rendition = media.renditions[variant];
  const { x, y } = focal ?? media.focal;
  /* `unoptimized` serves every rendition from its own URL: our route for a
     manual image, the provider's host for a provider image (which Unsplash
     requires — the Next.js optimiser would copy it onto ours). */
  return <Image className={className} src={rendition.url} alt={media.altText} width={rendition.width}
    height={rendition.height} loading={loading} decoding="async" unoptimized draggable={false}
    style={{
      objectPosition: `${x}% ${y}%`,
      ...(zoom && zoom !== 1 ? { transform: `scale(${zoom})`, transformOrigin: `${x}% ${y}%` } : {}),
    }} />;
}
