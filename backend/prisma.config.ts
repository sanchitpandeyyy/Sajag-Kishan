import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

for (const file of [".env.local", ".env"]) {
  config({ path: path.resolve(import.meta.dirname, file), quiet: true });
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url:
      process.env.DATABASE_URL_UNPOOLED ??
      process.env.DATABASE_URL ??
      "postgresql://placeholder:placeholder@localhost:5432/placeholder",
  },
});
