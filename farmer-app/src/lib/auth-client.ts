/**
 * Better Auth client for the farmer app.
 * The expo plugin stores the session cookie in SecureStore and attaches it to
 * auth requests; `authHeaders()` does the same for our own /v1 API calls.
 */
import { expoClient } from "@better-auth/expo/client";
import { adminClient, inferAdditionalFields, phoneNumberClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";
import { ac, roles } from "./permissions";

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8787";

export const authClient = createAuthClient({
  baseURL: `${API_URL}/v1/auth`,
  plugins: [
    // cookiePrefix must match `advanced.cookiePrefix` on the server, or the session is never refreshed after sign-in.
    expoClient({ scheme: "krishidristi", storagePrefix: "krishidristi", cookiePrefix: "krishidristi", storage: SecureStore }),
    phoneNumberClient(),
    adminClient({ ac, roles }),
    inferAdditionalFields({ user: { mustChangePassword: { type: "boolean", required: false } } }),
  ],
});

export const { useSession, signOut } = authClient;

/** Cookie header for authenticated calls to the KrishiDristi API. */
export async function authHeaders(): Promise<Record<string, string>> {
  const cookie = await authClient.getCookie();
  return cookie ? { Cookie: cookie } : {};
}

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
      return "यो खाता निष्क्रिय गरिएको छ। पालिकाको कृषि शाखामा सम्पर्क गर्नुहोस्।";
    default:
      return fallback ?? "केही गडबड भयो। फेरि प्रयास गर्नुहोस्।";
  }
}
