import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { createAuthMiddleware } from "better-auth/api";
import { admin, openAPI, phoneNumber } from "better-auth/plugins";
import { getPrisma } from "../db";
import { bumpDataVersion } from "./cache";
import { env } from "../env";
import { mobileSchema } from "../shared";
import { ac, roles } from "./permissions";

export const AUTH_BASE_PATH = "/v1/auth";

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
  appName: "Krishi Dristi",
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

  emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 8 },

  user: {
    additionalFields: {
      mustChangePassword: { type: "boolean", required: false, defaultValue: false, input: false },
    },
  },

  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/change-password") return;
      const userId = ctx.context.session?.user.id;
      if (!userId || ctx.context.returned instanceof Error) return;
      await getPrisma().user.update({ where: { id: userId }, data: { mustChangePassword: false } });
      bumpDataVersion(); // /me caches mustChangePassword
    }),
  },

  session: {
    // Farmers stay signed in (the app must work offline for months). Officers are still signed out
    // after OFFICER_IDLE_MS without use; that check lives in requireAuth.
    // Cookies may not live longer than 400 days (better-call throws, so sign-in would fail with a 500).
    // The session slides forward on use (updateAge), so a farmer who opens the app within a year stays signed in.
    expiresIn: 60 * 60 * 24 * 395,
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
    ipAddress: { ipAddressHeaders: ["x-forwarded-for", "x-real-ip", "cf-connecting-ip"] },
  },

  plugins: [
    phoneNumber({
      requireVerification: false,
      phoneNumberValidator: (value) => mobileSchema.safeParse(value).success,
      sendOTP: () => {
        throw new Error("OTP is disabled in Krishi Dristi");
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
