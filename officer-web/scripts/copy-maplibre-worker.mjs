// Serves MapLibre's web worker from /maplibre/ (Turbopack can't bundle it).
// Runs before `dev` and `build` so the files always match the installed maplibre-gl.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve("maplibre-gl/dist/maplibre-gl.css"));
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "maplibre");
mkdirSync(out, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) copyFileSync(join(dist, f), join(out, f));
console.log("[maplibre] worker copied to public/maplibre");
