/**
 * Loads backend env files once, in priority order:
 * 1. real environment variables (hosting platform), never overwritten
 * 2. `.env.local`, written by `neon deploy` / `neon env pull` (Neon credentials)
 * 3. `.env`, hand-written local settings (BETTER_AUTH_SECRET, CORS_ORIGINS and so on)
 * dotenv never overwrites a variable that is already set, so earlier sources win.
 */
import path from "node:path";
import { config } from "dotenv";

const root = path.resolve(import.meta.dirname, "..");
for (const file of [".env.local", ".env"]) {
  config({ path: path.join(root, file), quiet: true });
}
