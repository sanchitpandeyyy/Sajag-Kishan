import path from "node:path";
import { config } from "dotenv";

const root = path.resolve(import.meta.dirname, "..");
for (const file of [".env.local", ".env"]) {
  config({ path: path.join(root, file), quiet: true });
}
