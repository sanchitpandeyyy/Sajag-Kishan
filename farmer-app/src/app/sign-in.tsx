import { useState } from "react";
import { AuthScreen } from "@/components/auth-screen";
import { Field, Message, PrimaryButton } from "@/components/form";
import { API_URL, authClient, useSession } from "@/lib/auth-client";
import { useLang } from "@/lib/i18n";
import { showToast } from "@/lib/toast";
import { clearDataCache } from "@/lib/data-cache";

export default function SignIn() {
  const { tr } = useLang();
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { refetch } = useSession();

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      clearDataCache();
      const { error } = await authClient.signIn.phoneNumber({ phoneNumber: mobile.trim(), password, rememberMe: true });
      if (!error) {
        // Re-read the session so the root layout's guard opens the app right away.
        await refetch();
        return;
      }
      const fail = (text: string) => {
        setError(text);
        showToast(text);
      };
      if (error.code === "INVALID_PHONE_NUMBER_OR_PASSWORD" || error.code === "INVALID_PHONE_NUMBER") fail(tr("मोबाइल नम्बर वा पासवर्ड मिलेन", "Mobile number or password is incorrect"));
      else if (error.code === "BANNED_USER") fail(tr("यो खाता निष्क्रिय छ। कृषि शाखामा सम्पर्क गर्नुहोस्।", "This account is disabled. Please contact the agriculture office."));
      else if (error.status === 429) fail(tr("धेरै प्रयास भयो। एक मिनेट पर्खनुहोस्।", "Too many tries. Wait one minute."));
      else fail(`${tr("लगइन हुन सकेन", "Could not sign in")} (${error.status || "?"} ${error.code ?? error.message ?? ""})`);
    } catch (e) {
      // No reply from the server at all: wrong Wi-Fi, backend off, or firewall.
      const text = `${tr("सर्भरमा पुगेन", "Cannot reach the server")}: ${API_URL}`;
      console.warn("sign-in network error", e);
      setError(text);
      showToast(text);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthScreen title={tr("लगइन", "Sign in")} subtitle="" icon="person-circle-outline">
      <Field icon="call-outline" label={tr("मोबाइल", "Mobile")} value={mobile} onChangeText={setMobile} keyboardType="phone-pad" autoComplete="tel" placeholder="98XXXXXXXX" maxLength={10} />
      <Field icon="lock-closed-outline" label={tr("पासवर्ड", "Password")} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" />
      <Message error={error} />
      <PrimaryButton icon="log-in-outline" title={tr("लगइन", "Sign in")} onPress={submit} busy={busy} />
      <Message info={tr("पासवर्ड बिर्सनुभयो? कृषि शाखामा सोध्नुहोस्।", "Forgot password? Ask the agriculture office.")} />
    </AuthScreen>
  );
}
