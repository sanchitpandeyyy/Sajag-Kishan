import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { exportLanduseRows } from "./jobs";

const out = resolve(process.argv[2] ?? "../ml/data/landuse.csv");
const csv = await exportLanduseRows();
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, csv);
console.log(`wrote ${csv.trim().split("\n").length - 1} labelled fields to ${out}`);
process.exit(0);
