/**
 * Files in Neon Object Storage.
 *
 * POST /v1/files            multipart: file, entity ("parcel"), entityId → stores the object,
 *                           records a FileObject row, returns a presigned download URL.
 * GET  /v1/files?entity=&entityId=  list files for something you can see.
 * GET  /v1/files/:id/url    fresh presigned URL (15 min).
 *
 * Access: farmers only for their own parcels; officers for parcels in their local level.
 */
import { Hono } from "hono";
import { audit } from "../audit";
import { OFFICER_ROLES, requireAuth } from "../auth";
import { getPrisma } from "../db";
import { ALLOWED_CONTENT_TYPES, ASSETS_BUCKET, MAX_UPLOAD_BYTES, objectKey, presignedUrl, putObject, storageConfigured } from "../lib/storage";
import { farmerIdFor, wardScope } from "../scope";
import type { AppEnv, AuthUser } from "../types";

const ENTITIES = new Set(["parcel"]);

/** May this user attach/read files on this entity? */
async function canAccess(user: AuthUser, entity: string, entityId: string): Promise<boolean> {
  if (entity !== "parcel") return OFFICER_ROLES.includes(user.role);
  const prisma = getPrisma();
  const where =
    user.role === "FARMER" ? { id: entityId, farmerId: await farmerIdFor(user) } : { id: entityId, ward: await wardScope(user) };
  return (await prisma.parcel.count({ where })) > 0;
}

export const fileRoutes = new Hono<AppEnv>()
  .use("*", requireAuth)
  .use("*", async (c, next) => {
    if (!storageConfigured()) return c.json({ error: "storage_not_configured" }, 503);
    await next();
  })
  .post("/", async (c) => {
    const user = c.get("user");
    const body = await c.req.parseBody();
    const file = body.file;
    const entity = String(body.entity ?? "");
    const entityId = String(body.entityId ?? "");
    if (!(file instanceof File)) return c.json({ error: "file_required" }, 400);
    if (!ENTITIES.has(entity) || !entityId) return c.json({ error: "invalid_entity" }, 400);
    if (file.size > MAX_UPLOAD_BYTES) return c.json({ error: "file_too_large", maxBytes: MAX_UPLOAD_BYTES }, 413);
    if (!ALLOWED_CONTENT_TYPES.has(file.type)) return c.json({ error: "unsupported_type", type: file.type }, 415);
    if (!(await canAccess(user, entity, entityId))) return c.json({ error: "not_found" }, 404);

    const key = objectKey(entity, entityId, file.name);
    await putObject(key, new Uint8Array(await file.arrayBuffer()), file.type);
    const row = await getPrisma().fileObject.create({
      data: { bucket: ASSETS_BUCKET, key, fileName: file.name, contentType: file.type, sizeBytes: file.size, entity, entityId, uploadedById: user.id },
    });
    await audit(user.id, "file.upload", "FileObject", row.id, null, { entity, entityId, key });
    return c.json({ ...row, url: await presignedUrl(key) }, 201);
  })
  .get("/", async (c) => {
    const user = c.get("user");
    const entity = c.req.query("entity") ?? "";
    const entityId = c.req.query("entityId") ?? "";
    if (!ENTITIES.has(entity) || !entityId) return c.json({ error: "invalid_entity" }, 400);
    if (!(await canAccess(user, entity, entityId))) return c.json({ error: "not_found" }, 404);
    const rows = await getPrisma().fileObject.findMany({ where: { entity, entityId }, orderBy: { createdAt: "desc" }, take: 100 });
    return c.json(await Promise.all(rows.map(async (r) => ({ ...r, url: await presignedUrl(r.key) }))));
  })
  .get("/:id/url", async (c) => {
    const user = c.get("user");
    const row = await getPrisma().fileObject.findUnique({ where: { id: c.req.param("id") } });
    if (!row || !(await canAccess(user, row.entity, row.entityId))) return c.json({ error: "not_found" }, 404);
    return c.json({ url: await presignedUrl(row.key), expiresIn: 900 });
  });
