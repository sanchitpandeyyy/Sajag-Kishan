import { AnekDevanagari_600SemiBold, AnekDevanagari_700Bold } from "@expo-google-fonts/anek-devanagari";
import { Mukta_400Regular, Mukta_600SemiBold } from "@expo-google-fonts/mukta";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { BrandSplash } from "@/components/brand-splash";
import { OfflineBanner } from "@/components/offline-banner";
import { useSession } from "@/lib/auth-client";
import { LangProvider } from "@/lib/i18n";
import { installGlobalErrorToasts, ToastHost } from "@/lib/toast";
import { theme } from "@/theme";

SplashScreen.preventAutoHideAsync().catch(() => undefined);
// Optional error tracking: guarded so a hot reload or missing native hook can never stop the app starting.
if (typeof installGlobalErrorToasts === "function") installGlobalErrorToasts();

function Routes() {
  const { data: session, isPending } = useSession();
  const [fontsLoaded, fontError] = useFonts({
    AnekDevanagari_600SemiBold,
    AnekDevanagari_700Bold,
    Mukta_400Regular,
    Mukta_600SemiBold,
  });
  // A saved session opens the app at once (works offline); otherwise wait for the server check.
  const ready = (fontsLoaded || !!fontError) && (!isPending || !!session?.user);
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;
  const signedIn = !!session?.user;
  const mustChange = signedIn && !!session.user.mustChangePassword;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.page } }}>
        <Stack.Protected guard={signedIn && !mustChange}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="subsidy" />
        </Stack.Protected>
        <Stack.Protected guard={mustChange}>
          <Stack.Screen name="change-password" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>
      {signedIn && <OfflineBanner />}
      {!splashDone && <BrandSplash onDone={() => setSplashDone(true)} />}
      <ToastHost />
    </>
  );
}

export default function RootLayout() {
  return (
    <LangProvider>
      <Routes />
    </LangProvider>
  );
}
