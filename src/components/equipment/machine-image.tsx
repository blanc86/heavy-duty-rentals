import Image from "next/image";
import { IMAGES, type ImageKey } from "@/content/images.generated";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/components/ui";

/**
 * A site image with its intrinsic size, blur placeholder and localized alt.
 *
 * Width and height come from the generated manifest, so the browser reserves
 * the exact box before the file arrives — no layout shift — and `sizes` lets
 * next/image send a phone the 640 px AVIF instead of the 1600 px JPEG.
 *
 * Loading priority follows Next 16's guidance: `preload` only for the one image
 * that is the page's Largest Contentful Paint (it adds a <link> to <head>);
 * `fetchPriority="high"` for other images that are visible on arrival; lazy
 * for everything else, which is the default.
 */
export function SiteImage({
  imageKey,
  locale,
  sizes,
  className,
  fill = false,
  preload = false,
  eager = false,
  decorative = false,
}: {
  imageKey: ImageKey;
  locale: Locale;
  sizes: string;
  className?: string;
  fill?: boolean;
  /** The page's LCP image. At most one per page. */
  preload?: boolean;
  /** Visible on arrival but not the LCP element. */
  eager?: boolean;
  /**
   * Inside a link or heading that already names the machine. Empty alt, so a
   * screen reader does not read a photo description before every name.
   */
  decorative?: boolean;
}) {
  const image = IMAGES[imageKey];
  return (
    <Image
      src={image.src}
      alt={decorative ? "" : image.alt[locale]}
      {...(fill ? { fill: true } : { width: image.width, height: image.height })}
      sizes={sizes}
      placeholder="blur"
      blurDataURL={image.blurDataURL}
      {...(preload ? { preload: true } : eager ? { loading: "eager" as const, fetchPriority: "high" as const } : {})}
      className={cn("object-cover", className)}
    />
  );
}

/**
 * A small thumbnail at a fixed display size.
 *
 * Kept separate from SiteImage on purpose. A fixed width gives next/image a
 * two-entry srcset (1x and 2x) instead of the full responsive ladder, and a
 * blur placeholder is pointless at 80 px. The fleet strip renders 36 of these,
 * so the difference is tens of kilobytes of HTML on the home page. It is always
 * shown beside the machine's name, so it carries no alt text of its own.
 */
export function Thumbnail({
  imageKey,
  width,
  height,
  className,
}: {
  imageKey: ImageKey;
  width: number;
  height: number;
  className?: string;
}) {
  const image = IMAGES[imageKey];
  return (
    <Image
      src={image.src}
      // Always beside the machine's name, so decorative.
      alt=""
      width={width}
      height={height}
      className={cn("h-full w-full object-cover", className)}
    />
  );
}

export function machineImageKey(slug: string): ImageKey {
  return `equipment/${slug}` as ImageKey;
}
