import { createHash } from "node:crypto";
import { objectExists, presignedUrl, putObject, storageConfigured } from "../lib/storage";

const ALLOWED_HOSTS = new Set(["planetarycomputer.microsoft.com"]);
const MAX_BYTES = 8 * 1024 * 1024;

export function isAllowedImageSource(src: string): boolean {
  try {
    const u = new URL(src);
    return u.protocol === "https:" && ALLOWED_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

export function imageKey(src: string): string {
  return `satellite/${createHash("sha256").update(src).digest("hex").slice(0, 40)}.jpg`;
}

const pending = new Map<string, Promise<boolean>>();

async function storeOnce(key: string, src: string): Promise<boolean> {
  if (await objectExists(key)) return true;
  const res = await fetch(src, { signal: AbortSignal.timeout(30_000) });
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || !type.startsWith("image/")) return false;
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) return false;
  await putObject(key, bytes, type);
  return true;
}

/**
 * Satellite pictures are rendered by Planetary Computer on request (slow, and gone if the service changes).
 * Store each picture in the Neon "assets" bucket the first time it is seen, then serve it from there.
 * Returns a URL to redirect to: the stored copy, or the original when storage is unavailable.
 */
export async function storedImageUrl(src: string): Promise<string> {
  if (!storageConfigured()) return src;
  const key = imageKey(src);
  try {
    let job = pending.get(key);
    if (!job) {
      job = storeOnce(key, src).finally(() => pending.delete(key));
      pending.set(key, job);
    }
    return (await job) ? await presignedUrl(key, 60 * 60) : src;
  } catch {
    return src;
  }
}
