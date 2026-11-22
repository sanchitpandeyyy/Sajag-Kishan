export const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

export interface UploadedAudio {
  bytes: Buffer;
  mimeType: string;
}

const DEFAULT_MIME = "audio/mp4";
const AUDIO_MIME = /^audio\/[\w.+-]+$/i;

const cleanMime = (m: unknown) => (typeof m === "string" && AUDIO_MIME.test(m.trim()) ? m.trim().toLowerCase() : DEFAULT_MIME);

/**
 * Voice input arrives two ways:
 *  - JSON { audio: <base64>, mimeType } (what the farmer app sends; file parts are unreliable in React Native)
 *  - multipart form with a file in the "audio" field (curl, web clients)
 * Returns null when there is no usable audio.
 */
export async function audioFromRequest(req: Request): Promise<UploadedAudio | null> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const j = (await req.json().catch(() => null)) as { audio?: unknown; mimeType?: unknown } | null;
    if (typeof j?.audio !== "string" || !j.audio) return null;
    const base64 = j.audio.replace(/^data:[^,]*,/, "");
    const bytes = Buffer.from(base64, "base64");
    return bytes.length ? { bytes, mimeType: cleanMime(j.mimeType) } : null;
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("audio");
  if (!(file instanceof File) || file.size === 0) return null;
  return { bytes: Buffer.from(await file.arrayBuffer()), mimeType: cleanMime(file.type) };
}
