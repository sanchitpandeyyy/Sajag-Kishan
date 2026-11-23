import { getPrisma } from "../db";
import { syncParcelHistory } from "./history";
import { runSync, syncParcel, syncStatus } from "./sync";

/** Sentinel-2 revisits every ~5 days and Sentinel-1 every ~6-12; new scenes land on Planetary Computer within a day. */
export const AUTO_INTERVAL_MS = 6 * 3_600_000;
/** Re-check history at most weekly; windows that already have clear readings are skipped, so reruns are cheap. */
const HISTORY_RECHECK_MS = 7 * 86_400_000;
const historyCheckedAt = new Map<string, number>();

async function mappedParcels(): Promise<string[]> {
  const rows = await getPrisma().parcel.findMany({ where: { centroidLat: { not: null }, centroidLng: { not: null } }, select: { id: true }, orderBy: { updatedAt: "desc" } });
  return rows.map((r) => r.id);
}

/**
 * One automatic pass: pull any new scenes for every mapped field, then backfill older seasons
 * for fields whose history hasn't been checked recently. Skips if a manual run is in progress.
 */
export async function satelliteAutoTick(): Promise<void> {
  if (syncStatus.running) return;
  const ids = await mappedParcels();
  if (!ids.length) return;

  const recent = runSync(ids, { trigger: "auto", phase: "recent", worker: (id) => syncParcel(id, { months: 2, maxScenes: 12 }) });
  if (!recent) return;
  await recent;
  console.log(`[satellite] recent pass: ${syncStatus.parcelsDone} fields, +${syncStatus.observations} readings, ${syncStatus.errors.length} errors`);

  const now = Date.now();
  const due = ids.filter((id) => now - (historyCheckedAt.get(id) ?? 0) > HISTORY_RECHECK_MS);
  if (due.length) {
    const history = runSync(due, {
      trigger: "auto",
      phase: "history",
      worker: async (id) => {
        const n = await syncParcelHistory(id);
        historyCheckedAt.set(id, Date.now());
        return n;
      },
    });
    if (history) {
      await history;
      console.log(`[satellite] history pass: ${syncStatus.parcelsDone} fields, +${syncStatus.observations} readings, ${syncStatus.errors.length} errors`);
    }
  }
  syncStatus.lastAutoRunAt = new Date().toISOString();
}

export function scheduleSatelliteAuto(firstDelayMs = 2 * 60_000) {
  const run = async () => {
    try {
      await satelliteAutoTick();
    } catch (e) {
      console.error("[satellite] auto tick failed", e);
    } finally {
      syncStatus.nextAutoRunAt = new Date(Date.now() + AUTO_INTERVAL_MS).toISOString();
      setTimeout(run, AUTO_INTERVAL_MS);
    }
  };
  syncStatus.nextAutoRunAt = new Date(Date.now() + firstDelayMs).toISOString();
  setTimeout(run, firstDelayMs);
}
