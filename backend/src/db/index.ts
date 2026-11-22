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
    console.warn("[db] DATABASE_URL is not set, so database features are disabled until you run `neon env pull` in backend/");
    connectionString = "postgresql://offline:offline@127.0.0.1:1/offline";
  }
  connectionString = connectionString.replace(/([?&])sslmode=(prefer|require|verify-ca)\b/, "$1sslmode=verify-full");
  const adapter = new PrismaPg({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: 240_000,
    keepAlive: true,
    connectionTimeoutMillis: 20_000,
  });
  return new PrismaClient({ adapter });
}

export function getPrisma(): PrismaClient {
  globalThis.__krishiPrisma ??= createPrismaClient();
  return globalThis.__krishiPrisma;
}
