/**
 * Shown right after signing in with a temporary password issued by the agriculture
 * officer. The farmer must choose their own password before using the app. No OTP.
 */
import { useState } from "react";
import { AuthScreen } from "@/components/auth-screen";
import { Field, LinkButton, Message, PrimaryButton } from "@/components/form";
import { authClient, signOut, useSession } from "@/lib/auth-client";
import { useLang } from "@/lib/i18n";

export default function ChangePassword() {
  const { tr } = useLang();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { refetch } = useSession();

  async function submit() {
    if (next.length < 8) return setError(tr("पासवर्ड कम्तीमा ८ अक्षर वा अङ्कको हुनुपर्छ", "Password must be at least 8 characters"));
    if (next !== confirm) return setError(tr("दुवै पासवर्ड एउटै हुनुपर्छ", "Both passwords must match"));
    setBusy(true);
    setError(null);
    const { error } = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true });
    if (error) {
      setBusy(false);
      return setError(error.code === "INVALID_PASSWORD" ? tr("अस्थायी पासवर्ड मिलेन", "The temporary password is incorrect") : tr("पासवर्ड बदल्न सकिएन", "Could not change the password"));
    }
    // Bypass the 5-minute session cookie cache so the guard sees mustChangePassword = false.
    await authClient.getSession({ query: { disableCookieCache: true } });
    await refetch();
    setBusy(false);
  }

  return (
    <AuthScreen title={tr("नयाँ पासवर्ड", "New password")} subtitle="" icon="key-outline">
      <Field icon="time-outline" label={tr("अस्थायी पासवर्ड", "Temporary password")} value={current} onChangeText={setCurrent} secureTextEntry autoComplete="current-password" autoCapitalize="characters" />
      <Field icon="lock-closed-outline" label={tr("नयाँ पासवर्ड (८+)", "New password (8+)")} value={next} onChangeText={setNext} secureTextEntry autoComplete="new-password" />
      <Field icon="checkmark-done-outline" label={tr("फेरि लेख्नुहोस्", "Repeat")} value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" />
      <Message error={error} />
      <PrimaryButton icon="save-outline" title={tr("पासवर्ड बदल्नुहोस्", "Change password")} onPress={submit} busy={busy} />
      <LinkButton title={tr("बाहिर निस्कनुहोस्", "Sign out")} onPress={() => signOut()} />
    </AuthScreen>
  );
}
