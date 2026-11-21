import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { getPrisma } from "./db";
import { env } from "./env";
import { ASSETS_BUCKET, deleteObject, getObjectBytes, putObject, storageConfigured } from "./lib/storage";
import { auth, AUTH_BASE_PATH } from "./lib/auth";
import { adviceRoutes } from "./routes/advice";
import { alertRoutes } from "./routes/alerts";
import { meRoutes } from "./routes/auth";
import { calendarRoutes } from "./routes/calendar";
import { cropRoutes } from "./routes/crops";
import { declarationRoutes } from "./routes/declarations";
import { engineRoutes } from "./routes/engine";
import { farmerRoutes } from "./routes/farmers";
import { fileRoutes } from "./routes/files";
import { geoRoutes } from "./routes/geo";
import { integrationRoutes } from "./routes/integrations";
import { mapRoutes } from "./routes/map";
import { dashboardRoutes } from "./routes/dashboard";
import { officerRoutes } from "./routes/officers";
import { parcelRoutes } from "./routes/parcels";
import { chatRoutes } from "./routes/chat";
import { satelliteRoutes } from "./routes/satellite";
import { pushRoutes } from "./routes/push";
import { subsidyRoutes } from "./routes/subsidies";
import type { AppEnv } from "./types";

export const app = new Hono<AppEnv>();

app.use("*", logger());
// CORS must be registered before the Better Auth handler. Explicit origins only (credentials: true).
app.use(
  "*",
  cors({
    origin: env.corsOrigins,
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization", "Cookie"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length", "Set-Cookie"],
    maxAge: 600,
  }),
);

app.get("/health", (c) => c.json({ ok: true, service: "krishidristi-api", time: new Date().toISOString() }));

/** Readiness: proves Postgres and Object Storage are reachable (no secrets returned). */
app.get("/health/ready", async (c) => {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};
  try {
    const rows = await getPrisma().$queryRaw<{ now: Date; version: string }[]>`select now() as now, version() as version`;
    checks.postgres = { ok: true, detail: rows[0]?.version.split(" ").slice(0, 2).join(" ") };
  } catch (e) {
    checks.postgres = { ok: false, detail: e instanceof Error ? e.message.slice(0, 200) : String(e) };
  }
  try {
    if (!storageConfigured()) throw new Error("not configured");
    const key = `health/${Date.now()}.txt`;
    await putObject(key, "ok", "text/plain");
    const back = new TextDecoder().decode(await getObjectBytes(key));
    await deleteObject(key);
    checks.objectStorage = { ok: back === "ok", detail: `bucket ${ASSETS_BUCKET}: put/get/delete` };
  } catch (e) {
    checks.objectStorage = { ok: false, detail: e instanceof Error ? e.message.slice(0, 200) : String(e) };
  }
  const ok = Object.values(checks).every((x) => x.ok);
  return c.json({ ok, checks }, ok ? 200 : 503);
});

// Better Auth: phone+password sign-in, change-password, sessions, admin, reference docs (/v1/auth/reference). No OTP.
app.on(["GET", "POST"], `${AUTH_BASE_PATH}/*`, (c) => auth.handler(c.req.raw));

const v1 = new Hono<AppEnv>()
  .route("/me", meRoutes)
  .route("/geo", geoRoutes)
  .route("/crops", cropRoutes)
  .route("/engine", engineRoutes)
  .route("/parcels", parcelRoutes)
  .route("/declarations", declarationRoutes)
  .route("/calendar", calendarRoutes)
  .route("/alerts", alertRoutes)
  .route("/advice", adviceRoutes)
  .route("/map", mapRoutes)
  .route("/dashboard", dashboardRoutes)
  .route("/farmers", farmerRoutes)
  .route("/officers", officerRoutes)
  .route("/files", fileRoutes)
  .route("/satellite", satelliteRoutes)
  .route("/chat", chatRoutes)
  .route("/subsidies", subsidyRoutes)
  .route("/integrations", integrationRoutes)
  .route("/push", pushRoutes);
app.route("/v1", v1);

app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: "internal_error", message: env.isProd ? undefined : err.message }, 500);
});
app.notFound((c) => c.json({ error: "not_found" }, 404));
