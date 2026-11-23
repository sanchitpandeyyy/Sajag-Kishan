export const FERTILIZER_DOSE_KG_HA: Record<string, Record<string, number>> = {
  paddy: { Urea: 180, DAP: 65, MOP: 50 },
  wheat: { Urea: 200, DAP: 110, MOP: 40 },
  maize: { Urea: 250, DAP: 130, MOP: 70 },
  potato: { Urea: 220, DAP: 220, MOP: 100 },
  mustard: { Urea: 110, DAP: 85, MOP: 35 },
  lentil: { Urea: 20, DAP: 85, MOP: 30 },
  millet: { Urea: 80, DAP: 45, MOP: 30 },
};

export interface FarmerNeedInput {
  farmerId: string;
  registeredAreaM2: number;
  crops: { crop: string; areaM2: number }[];
  alreadyDeliveredKg: number;
  tenant: boolean;
  verified: boolean;
  recentSubsidyKg: number;
  claimedAreaM2?: number;
}

export interface AllocationLine {
  farmerId: string;
  needKg: number;
  priority: number;
  allocatedKg: number;
  flags: string[];
}

export const PRIORITY_WEIGHTS = { smallholder: 0.35, tenant: 0.25, verified: 0.2, notRecentlyServed: 0.2 } as const;

export function farmerNeedKg(input: FarmerNeedInput, product: string): number {
  const need = input.crops.reduce((sum, c) => sum + (c.areaM2 / 10_000) * (FERTILIZER_DOSE_KG_HA[c.crop]?.[product] ?? 0), 0);
  return Math.max(0, Math.round(need - input.alreadyDeliveredKg));
}

export function priorityScore(input: FarmerNeedInput): number {
  const w = PRIORITY_WEIGHTS;
  const smallholder = input.registeredAreaM2 < 5_000 ? 1 : input.registeredAreaM2 < 10_000 ? 0.5 : 0;
  const notRecent = input.recentSubsidyKg === 0 ? 1 : input.recentSubsidyKg < 50 ? 0.5 : 0;
  return Math.round((w.smallholder * smallholder + w.tenant * (input.tenant ? 1 : 0) + w.verified * (input.verified ? 1 : 0) + w.notRecentlyServed * notRecent) * 100) / 100;
}

export function misuseFlags(input: FarmerNeedInput): string[] {
  const flags: string[] = [];
  if (input.claimedAreaM2 != null && input.claimedAreaM2 > input.registeredAreaM2 * 1.05) flags.push("CLAIM_EXCEEDS_REGISTERED_AREA");
  const cultivated = input.crops.reduce((s, c) => s + c.areaM2, 0);
  if (cultivated === 0) flags.push("NO_CULTIVATION_DECLARED");
  if (cultivated > input.registeredAreaM2 * 1.05) flags.push("CULTIVATED_EXCEEDS_REGISTERED_AREA");
  return flags;
}

export function allocate(farmers: FarmerNeedInput[], product: string, stockKg: number): AllocationLine[] {
  const BLOCKING = new Set(["NO_CULTIVATION_DECLARED", "CULTIVATED_EXCEEDS_REGISTERED_AREA"]);
  const lines = farmers.map((f) => {
    const flags = misuseFlags(f);
    const blocked = flags.some((x) => BLOCKING.has(x));
    return { farmerId: f.farmerId, needKg: blocked ? 0 : farmerNeedKg(f, product), priority: priorityScore(f), allocatedKg: 0, flags };
  });

  const totalNeed = lines.reduce((s, l) => s + l.needKg, 0);
  if (totalNeed <= stockKg) {
    lines.forEach((l) => (l.allocatedKg = l.needKg));
    return lines;
  }

  let remaining = stockKg;
  let open = lines.filter((l) => l.needKg > 0);
  while (remaining > 0.5 && open.length) {
    const weightSum = open.reduce((s, l) => s + l.needKg * (0.5 + l.priority), 0);
    let used = 0;
    for (const l of open) {
      const share = (remaining * l.needKg * (0.5 + l.priority)) / weightSum;
      const give = Math.min(share, l.needKg - l.allocatedKg);
      l.allocatedKg += give;
      used += give;
    }
    remaining -= used;
    open = open.filter((l) => l.needKg - l.allocatedKg > 0.5);
    if (used < 0.5) break;
  }
  lines.forEach((l) => (l.allocatedKg = Math.floor(l.allocatedKg)));
  return lines;
}

export function demandByProduct(farmers: FarmerNeedInput[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const product of ["Urea", "DAP", "MOP"]) {
    out[product] = farmers.reduce((s, f) => s + farmerNeedKg(f, product), 0);
  }
  return out;
}
