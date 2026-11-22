import "./load-env";

const isProd = process.env.NODE_ENV === "production";
const authSecret = process.env.BETTER_AUTH_SECRET ?? (isProd ? undefined : "dev-only-insecure-secret-change-me-0123456789");
if (!authSecret) throw new Error("BETTER_AUTH_SECRET must be set in production");

const port = Number(process.env.API_PORT ?? process.env.PORT ?? 8787);

export const env = {
  isProd,
  port,
  authUrl: process.env.BETTER_AUTH_URL ?? `http://localhost:${port}`,
  authSecret,
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:3000").split(",").map((s) => s.trim()).filter(Boolean),
};
