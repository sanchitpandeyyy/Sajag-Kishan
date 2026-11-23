import { expoClient } from "@better-auth/expo/client";
import { adminClient, inferAdditionalFields, phoneNumberClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";
import { ac, roles } from "./permissions";
import { clearDataCache } from "./data-cache";
import { clearOutbox } from "./outbox";
import { showToast } from "./toast";

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8787").replace(/\/+$/, "");

export const authClient = createAuthClient({
  baseURL: `${API_URL}/v1/auth`,
  fetchOptions: {
    onError: ({ error, request }) => {
      const path = new URL(request.url).pathname.replace(/^\/v1\/auth/, "");
      if (path.startsWith("/sign-in")) return; // sign-in screen shows its own message
      if (error.status === 404) return; // unavailable endpoint: stay quiet
      showToast(`Auth ${path}: ${error.status || "?"} ${error.code ?? error.message ?? error.statusText ?? ""}`.trim());
    },
  },
  plugins: [
    expoClient({ scheme: "krishidristi", storagePrefix: "krishidristi", cookiePrefix: "krishidristi", storage: SecureStore }),
    phoneNumberClient(),
    adminClient({ ac, roles }),
    inferAdditionalFields({ user: { mustChangePassword: { type: "boolean", required: false } } }),
  ],
});

export const { useSession } = authClient;

export function signOut(...args: Parameters<typeof authClient.signOut>) {
  clearDataCache();
  clearOutbox(); // unsent changes belong to this account only
  return authClient.signOut(...args);
}

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
