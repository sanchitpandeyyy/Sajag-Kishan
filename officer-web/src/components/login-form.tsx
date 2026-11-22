"use client";

/**
 * Officer / admin sign-in (mobile + password, no OTP). Used on the landing page and /login.
 * Temporary passwords must be replaced before entering the admin side.
 * On success → /dashboard (or a safe ?next= path).
 */
import { useEffect, useState } from "react";
import { authClient, authErrorNe, isOfficerRole } from "@/lib/auth-client";
import { buttonClass } from "@/components/ui";
import { useLang } from "@/lib/i18n";

const input = "mt-2 block min-h-12 w-full rounded-control border-[1.5px] border-input-border bg-white px-4 text-base text-ink placeholder:text-muted focus:border-brand-700 focus:outline-none";
const label = "block text-h4 text-ink";

export function LoginForm({ compact = false }: { compact?: boolean }) {
  const { tr } = useLang();
  const [step, setStep] = useState<"login" | "change">("login");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Sent here because the password is still temporary: start over so we have the current password.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("change") === "1") {
      void authClient.signOut();
      setError(tr("अस्थायी पासवर्डले लगइन गरी आफ्नै पासवर्ड बनाउनुहोस्।", "Sign in with your temporary password, then set your own."));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goNext() {
    const next = new URLSearchParams(window.location.search).get("next");
    window.location.href = next?.startsWith("/") && !next.startsWith("//") && next !== "/" ? next : "/dashboard";
  }

  function errorText(code?: string, message?: string) {
    if (code === "INVALID_PHONE_NUMBER_OR_PASSWORD" || code === "INVALID_PHONE_NUMBER") return tr("मोबाइल नम्बर वा पासवर्ड मिलेन", "Mobile number or password is incorrect");
    if (code === "INVALID_PASSWORD") return tr("हालको पासवर्ड मिलेन", "Current password is incorrect");
    if (code === "PASSWORD_TOO_SHORT") return tr("पासवर्ड कम्तीमा ८ अक्षर वा अङ्कको हुनुपर्छ", "Password must be at least 8 characters");
    if (code === "BANNED_USER") return tr("यो खाता निष्क्रिय गरिएको छ", "This account is disabled");
    return message ? authErrorNe(code, message) : tr("लगइन हुन सकेन", "Could not sign in");
  }

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { data, error } = await authClient.signIn.phoneNumber({ phoneNumber: mobile.trim(), password, rememberMe: true });
      if (error) return setError(errorText(error.code, error.message));
      const user = data?.user as { role?: string; mustChangePassword?: boolean } | undefined;
      if (!isOfficerRole(user?.role)) {
        // Same message as a wrong password: never reveal that a non-officer account exists.
        await authClient.signOut();
        return setError(errorText("INVALID_PHONE_NUMBER_OR_PASSWORD"));
      }
      if (user?.mustChangePassword) return setStep("change");
      goNext();
    } finally {
      setBusy(false);
    }
  }

  async function change(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error } = await authClient.changePassword({ currentPassword: password, newPassword, revokeOtherSessions: true });
      if (error) return setError(errorText(error.code, error.message));
      goNext();
    } finally {
      setBusy(false);
    }
  }

  const button = buttonClass("primary", "lg", "w-full");

  return step === "login" ? (
    <form onSubmit={login} className="flex flex-col gap-5">
      {!compact && <h2 className="font-heading text-h2 text-ink">{tr("कृषि शाखा लगइन", "Agriculture office sign in")}</h2>}
      <label className={label}>
        {tr("मोबाइल नम्बर", "Mobile number")}
        <input inputMode="numeric" autoComplete="username" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="98XXXXXXXX" className={input} required />
      </label>
      <label className={label}>
        {tr("पासवर्ड", "Password")}
        <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} required />
      </label>
      {error && (
        <p role="alert" className="text-small font-medium text-danger">
          {error}
        </p>
      )}
      <button disabled={busy} className={button}>
        {busy ? tr("लगइन हुँदैछ", "Signing in") : tr("लगइन गर्नुहोस्", "Sign in")}
      </button>
      <p className="text-small text-muted">{tr("पासवर्ड बिर्सनुभयो? सुपर एडमिनबाट नयाँ अस्थायी पासवर्ड लिनुहोस्।", "Forgot your password? Ask the super admin for a new temporary one.")}</p>
    </form>
  ) : (
    <form onSubmit={change} className="flex flex-col gap-5">
      <h2 className="font-heading text-h2 text-ink">{tr("नयाँ पासवर्ड बनाउनुहोस्", "Set a new password")}</h2>
      <p className="text-body">{tr("तपाईंले अस्थायी पासवर्डबाट लगइन गर्नुभयो। अगाडि बढ्न आफ्नै पासवर्ड राख्नुहोस्।", "You signed in with a temporary password. Choose your own to continue.")}</p>
      <label className={label}>
        {tr("नयाँ पासवर्ड (कम्तीमा ८ अक्षर)", "New password (min. 8 characters)")}
        <input type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={input} required />
      </label>
      {error && (
        <p role="alert" className="text-small font-medium text-danger">
          {error}
        </p>
      )}
      <button disabled={busy} className={button}>
        {busy ? tr("सेट हुँदैछ", "Saving") : tr("पासवर्ड सेट गर्नुहोस्", "Set password")}
      </button>
    </form>
  );
}
