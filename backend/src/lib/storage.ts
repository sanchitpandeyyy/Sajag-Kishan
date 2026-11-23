import "../load-env";
import { randomUUID } from "node:crypto";
import { Files } from "files-sdk";
import { neon } from "files-sdk/neon";

export const ASSETS_BUCKET = "assets";

export const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

let files: Files | undefined;

export function storageConfigured(): boolean {
  return Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_ENDPOINT_URL_S3);
}

function client(): Files {
  if (!storageConfigured()) throw new Error("Object storage is not configured. Run `neon deploy` in backend/.");
  files ??= new Files({ adapter: neon({ bucket: ASSETS_BUCKET }) });
  return files;
}

export function objectKey(entity: string, entityId: string, fileName: string): string {
  const clean = (s: string) => s.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "file";
  return `${clean(entity)}/${clean(entityId)}/${randomUUID()}-${clean(fileName)}`;
}

export async function putObject(key: string, body: Uint8Array | string, contentType: string): Promise<void> {
  await client().upload(key, body, { contentType });
}

export async function getObjectBytes(key: string): Promise<Uint8Array> {
  const file = await client().download(key);
  return new Uint8Array(await file.arrayBuffer());
}

export async function presignedUrl(key: string, expiresIn = 15 * 60): Promise<string> {
  return client().url(key, { expiresIn });
}

export async function deleteObject(key: string): Promise<void> {
  await client().delete(key);
}

export async function objectExists(key: string): Promise<boolean> {
  return client().exists(key);
}
