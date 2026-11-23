import { serve } from "@hono/node-server";
import { getPrisma } from "./db";
import { app } from "./app";
import { env } from "./env";
import { refreshWardAlerts } from "./jobs/alerts";
import { scheduleSatelliteAuto } from "./satellite/auto";

serve({ fetch: app.fetch, port: env.port, hostname: "0.0.0.0" }, (info) => {
  console.log(`Krishi Dristi API listening on http://localhost:${info.port}`);
});

const THREE_HOURS = 3 * 60 * 60 * 1000;
async function alertsTick() {
  if (!process.env.DATABASE_URL) return;
  try {
    const wards = await getPrisma().ward.findMany({ where: { parcels: { some: {} } }, select: { id: true } });
    const r = await refreshWardAlerts(wards.map((w) => w.id));
    console.log(`[alerts] wards=${r.wards} created=${r.created} pushed=${r.pushed} failures=${r.failures.length}`);
  } catch (e) {
    console.error("[alerts] tick failed", e);
  }
}
if (process.env.DISABLE_JOBS !== "true") {
  setTimeout(alertsTick, 10_000);
  setInterval(alertsTick, THREE_HOURS);
  if (process.env.DATABASE_URL) scheduleSatelliteAuto();
}
