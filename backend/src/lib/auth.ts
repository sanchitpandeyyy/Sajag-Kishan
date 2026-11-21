/**
 * Better Auth configuration.
 *
 * - Login: mobile number + password only (phoneNumber plugin), the same identity
 *   as the government farmer portal. **No OTP / SMS anywhere.**
 * - No public sign-up. Farmers are enrolled from the registry; an agriculture
 *   officer issues them a one-time temporary password (POST /v1/farmers/:id/password),
 *   which the farmer changes after first login. Officers are created by the super admin.
 * - Roles: FARMER, AGRICULTURE_OFFICER, SUPER_ADMIN via the admin plugin + access control
 *   (src/lib/permissions.ts).
 * - Farmer mobile app: expo plugin (session cookie kept in SecureStore).
 * - Officer web: same-origin cookies through the Next.js /api proxy.
 * - API reference: openAPI plugin at /v1/auth/reference.
 */
import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { createAuthMiddleware } from "better-auth/api";
import { admin, openAPI, phoneNumber } from "better-auth/plugins";
import { getPrisma } from "../db";
import { env } from "../env";
import { mobileSchema } from "../shared";
import { ac, roles } from "./permissions";

export const AUTH_BASE_PATH = "/v1/auth";

/** Endpoints we never expose: every OTP flow, plus email sign-in/sign-up/reset (emails are placeholders). */
const DISABLED_PATHS = [
  "/phone-number/send-otp",
  "/phone-number/verify",
  "/phone-number/request-password-reset",
  "/phone-number/reset-password",
  "/sign-in/email",
  "/sign-up/email",
  "/request-password-reset",
  "/reset-password",
  "/forget-password",
  "/send-verification-email",
  "/verify-email",
];

export const auth = betterAuth({
  appName: "KrishiDristi",
  baseURL: env.authUrl,
  basePath: AUTH_BASE_PATH,
  secret: env.authSecret,
  database: prismaAdapter(getPrisma(), { provider: "postgresql" }),
  disabledPaths: DISABLED_PATHS,

  trustedOrigins: [
    ...env.corsOrigins,
    "krishidristi://",
    ...(env.isProd ? [] : ["exp://", "exp://**", "exp://192.168.*.*:*/**"]),
  ],

  // Password machinery (hashing, credential accounts, change-password) stays on;
  // self sign-up does not.
  emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 8 },

  user: {
    additionalFields: {
      // Exposed on the session so the apps can force a password change after a temporary one.
      mustChangePassword: { type: "boolean", required: false, defaultValue: false, input: false },
    },
  },

  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/change-password") return;
      const userId = ctx.context.session?.user.id;
      if (!userId || ctx.context.returned instanceof Error) return;
      await getPrisma().user.update({ where: { id: userId }, data: { mustChangePassword: false } });
    }),
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days: farmers should rarely need to log in again
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },

  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/phone-number": { window: 60, max: 5 },
      "/change-password": { window: 60, max: 5 },
    },
  },

  advanced: {
    cookiePrefix: "krishidristi",
    useSecureCookies: env.isProd,
    // Per-client rate limits: the officer web proxy and hosting platforms forward the client IP.
    ipAddress: { ipAddressHeaders: ["x-forwarded-for", "x-real-ip", "cf-connecting-ip"] },
  },

  plugins: [
    phoneNumber({
      // Phone + password sign-in only. Numbers are trusted because they come from the
      // government registry or are entered by an officer, not self-claimed.
      requireVerification: false,
      phoneNumberValidator: (value) => mobileSchema.safeParse(value).success,
      sendOTP: () => {
        // Required by the plugin's types; every OTP route is in DISABLED_PATHS.
        throw new Error("OTP is disabled in KrishiDristi");
      },
    }),
    admin({
      ac,
      roles,
      defaultRole: "FARMER",
      adminRoles: ["SUPER_ADMIN"],
    }),
    expo(),
    openAPI(),
  ],
});

export type Session = typeof auth.$Infer.Session;
