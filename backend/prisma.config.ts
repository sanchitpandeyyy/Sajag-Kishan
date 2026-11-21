import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Same order as src/load-env.ts: .env.local (written by `neon deploy`) first, then .env.
for (const file of [".env.local", ".env"]) {
  config({ path: path.resolve(import.meta.dirname, file), quiet: true });
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations need the DIRECT (non-pooled) Neon connection: PgBouncer in transaction
    // mode breaks Prisma Migrate. The app itself uses the pooled DATABASE_URL.
    // A placeholder lets `prisma generate` run before Neon is configured.
    url:
      process.env.DATABASE_URL_UNPOOLED ??
      process.env.DATABASE_URL ??
      "postgresql://placeholder:placeholder@localhost:5432/placeholder",
  },
});
