/**
 * Prisma client for Lakebase Postgres on Neon.
 *
 * The backend is a long-running Node server (Hono on @hono/node-server), so it uses
 * node-postgres (`pg`) through @prisma/adapter-pg with one reused pool, connected to the
 * POOLED connection string (`DATABASE_URL`, hostname with `-pooler`). Migrations use the
 * direct `DATABASE_URL_UNPOOLED` instead (see prisma.config.ts).
 *
 * Only the backend imports this module, never the client apps.
 */
import "../load-env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

export * from "./generated/prisma/client";

declare global {
  var __krishiPrisma: PrismaClient | undefined;
}

export function createPrismaClient(connectionString = process.env.DATABASE_URL): PrismaClient {
  if (!connectionString) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("DATABASE_URL is not set. Run `neon deploy` (or `neon env pull`) in backend/ to write it to .env.local.");
    }
    // Dev without a database: the server still boots (engine demo endpoints work);
    // any query fails until DATABASE_URL is configured.
    console.warn("[db] DATABASE_URL is not set, so database features are disabled until you run `neon env pull` in backend/");
    connectionString = "postgresql://offline:offline@127.0.0.1:1/offline";
  }
  // Keep full TLS verification explicit: pg v9 will downgrade `sslmode=require` to libpq
  // semantics (encryption without certificate checks).
  connectionString = connectionString.replace(/([?&])sslmode=(prefer|require|verify-ca)\b/, "$1sslmode=verify-full");
  const adapter = new PrismaPg({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    // Opening a TLS connection to Neon costs several round trips (seconds from Nepal to
    // us-east-2), so keep pooled connections warm instead of reconnecting per request.
    idleTimeoutMillis: 240_000, // below Neon's 5-minute scale-to-zero
    keepAlive: true,
    connectionTimeoutMillis: 20_000, // allows for a scale-to-zero cold start
  });
  return new PrismaClient({ adapter });
}

/** Lazily created singleton (reused across hot reloads in dev). */
export function getPrisma(): PrismaClient {
  globalThis.__krishiPrisma ??= createPrismaClient();
  return globalThis.__krishiPrisma;
}
