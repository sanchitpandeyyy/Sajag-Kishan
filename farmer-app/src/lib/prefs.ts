/** Small on-phone preferences (kept in SecureStore, same as language). */
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useState } from "react";

const SPEAK_KEY = "sajagkishan.speakReplies";

/** Read answers aloud in Ask. On by default. */
export function useSpeakReplies(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(true);
  useEffect(() => {
    SecureStore.getItemAsync(SPEAK_KEY)
      .then((v) => setOn(v !== "off"))
      .catch(() => undefined);
  }, []);
  const set = useCallback((v: boolean) => {
    setOn(v);
    void SecureStore.setItemAsync(SPEAK_KEY, v ? "on" : "off").catch(() => undefined);
  }, []);
  return [on, set];
}

/** Read the saved value without a component (used right after a question is answered). */
export async function speakRepliesEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(SPEAK_KEY).catch(() => null)) !== "off";
}
