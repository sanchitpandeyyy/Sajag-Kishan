import { Hono } from "hono";
import { audit } from "../audit";
import { OFFICER_ROLES, requireAuth, requireRole } from "../auth";
import { getPrisma } from "../db";
import { CsvRegistryAdapter, importRecords } from "../integrations/registry";
import { objectKey, putObject, storageConfigured } from "../lib/storage";
import type { AppEnv } from "../types";

const MAX_CSV_BYTES = 5 * 1024 * 1024;

export const integrationRoutes = new Hono<AppEnv>()
  .use("*", requireAuth, requireRole(...OFFICER_ROLES))
  .post("/registry/import", async (c) => {
    let csv: string;
    const type = c.req.header("content-type") ?? "";
    if (type.startsWith("multipart/form-data")) {
      const file = (await c.req.parseBody()).file;
      if (!(file instanceof File)) return c.json({ error: "file_required" }, 400);
      if (file.size > MAX_CSV_BYTES) return c.json({ error: "file_too_large" }, 413);
      csv = await file.text();
    } else {
      csv = await c.req.text();
      if (csv.length > MAX_CSV_BYTES) return c.json({ error: "file_too_large" }, 413);
    }
    const report = await importRecords(new CsvRegistryAdapter(csv));

    let archivedKey: string | null = null;
    if (storageConfigured()) {
      try {
        archivedKey = objectKey("registry-import", new Date().toISOString().slice(0, 10), "registry.csv");
        await putObject(archivedKey, csv, "text/csv");
        await getPrisma().fileObject.create({
          data: { key: archivedKey, fileName: "registry.csv", contentType: "text/csv", sizeBytes: Buffer.byteLength(csv), entity: "registry-import", entityId: report.adapter, uploadedById: c.get("user").id },
        });
      } catch (e) {
        console.error("[registry] archive failed", e);
        archivedKey = null;
      }
    }
    await audit(c.get("user").id, "registry.import", "Registry", report.adapter, null, { ...report, errors: report.errors.length, archivedKey });
    return c.json({ ...report, archivedKey });
  });
