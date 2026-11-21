"use client";

import { adminClient, inferAdditionalFields, phoneNumberClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { ac, roles } from "./permissions";

const origin = typeof window === "undefined" ? (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000") : window.location.origin;

export const authClient = createAuthClient({
  baseURL: `${origin}/api/v1/auth`,
  plugins: [
    phoneNumberClient(),
    adminClient({ ac, roles }),
    inferAdditionalFields({ user: { mustChangePassword: { type: "boolean", required: false } } }),
  ],
});

export const { useSession, signOut } = authClient;

export const OFFICER_ROLES = ["AGRICULTURE_OFFICER", "SUPER_ADMIN"] as const;
export const isOfficerRole = (role: string | null | undefined) => !!role && (OFFICER_ROLES as readonly string[]).includes(role);

export function authErrorNe(code?: string, fallback?: string): string {
  switch (code) {
    case "INVALID_PHONE_NUMBER_OR_PASSWORD":
    case "INVALID_PHONE_NUMBER":
      return "मोबाइल नम्बर वा पासवर्ड मिलेन";
    case "INVALID_PASSWORD":
      return "हालको पासवर्ड मिलेन";
    case "PASSWORD_TOO_SHORT":
      return "पासवर्ड कम्तीमा ८ अक्षर वा अङ्कको हुनुपर्छ";
    case "BANNED_USER":
      return "यो खाता निष्क्रिय गरिएको छ";
    default:
      return fallback ?? "लगइन हुन सकेन";
  }
}
