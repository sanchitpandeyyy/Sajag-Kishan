import { AnekDevanagari_600SemiBold, AnekDevanagari_700Bold } from "@expo-google-fonts/anek-devanagari";
import { Mukta_400Regular, Mukta_600SemiBold } from "@expo-google-fonts/mukta";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useSession } from "@/lib/auth-client";
import { LangProvider } from "@/lib/i18n";
import { ToastHost } from "@/lib/toast";
import { theme } from "@/theme";

SplashScreen.preventAutoHideAsync();

function Routes() {
  const { data: session, isPending } = useSession();
  const [fontsLoaded, fontError] = useFonts({
    AnekDevanagari_600SemiBold,
    AnekDevanagari_700Bold,
    Mukta_400Regular,
    Mukta_600SemiBold,
  });
  const ready = (fontsLoaded || !!fontError) && !isPending;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;
  const signedIn = !!session?.user;
  // An officer-issued temporary password must be replaced before anything else.
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
