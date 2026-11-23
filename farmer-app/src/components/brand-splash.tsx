import { useEffect, useRef } from "react";
import { Animated, Image, StyleSheet, Text } from "react-native";
import { theme } from "@/theme";

/** Branded screen that picks up where the native splash ends, then fades into the app. */
export function BrandSplash({ onDone }: { onDone: () => void }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: true }),
      Animated.delay(500),
      Animated.timing(opacity, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start(() => onDone());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, { opacity }]}>
      <Animated.View style={[styles.center, { transform: [{ scale }] }]}>
        <Image source={require("../../assets/splash-icon.png")} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>कृषि दृष्टि</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: theme.colors.white, alignItems: "center", justifyContent: "center", zIndex: 2000, elevation: 2000 },
  center: { alignItems: "center" },
  logo: { width: 200, height: 200 },
  title: { marginTop: 8, fontFamily: theme.font.heading, fontSize: 34, color: theme.colors.brand[800] },
});
