import type { ImageLoaderProps } from "next/image";

/**
 * next/image loader for Unsplash: the Unsplash CDN resizes and re-encodes the photo,
 * so the browser downloads only the width it needs (no server-side optimisation round trip).
 */
export function unsplashLoader({ src, width, quality }: ImageLoaderProps): string {
  const url = new URL(src);
  url.searchParams.set("w", String(width));
  url.searchParams.set("q", String(quality ?? 70));
  url.searchParams.set("auto", "format");
  url.searchParams.set("fit", "crop");
  return url.toString();
}
