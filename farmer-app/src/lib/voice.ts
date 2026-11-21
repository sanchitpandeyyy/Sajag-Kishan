/**
 * Voice for the farmer chat.
 * - Listening: see useNepaliRecorder below (records, Gemini transcribes on the server).
 * - Speaking (text to speech): expo-speech, works everywhere. Uses a Nepali voice when the phone
 *   has one, else Hindi (same script, understandable), else the default voice.
 */
import { File } from "expo-file-system";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from "expo-audio";
import * as Speech from "expo-speech";
import { useRef } from "react";
import { api } from "./api";

/**
 * Speech to text (Nepali): record with the microphone, then the server transcribes it with Gemini.
 * Works in Expo Go and in builds (no phone speech service needed).
 * `start()` resolves false when the microphone permission is refused.
 * `stop()` resolves with the Nepali text ("" when nothing was heard).
 */
export function useNepaliRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const active = useRef(false);

  async function start(): Promise<boolean> {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) return false;
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    active.current = true;
    return true;
  }

  async function stop(): Promise<string> {
    if (!active.current) return "";
    active.current = false;
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    const uri = recorder.uri;
    if (!uri) return "";
    // Plain JSON over the same fetch path as the text questions (multipart file parts are
    // not supported by Expo's fetch, which is what failed with "Cannot reach the server").
    const audio = await new File(uri).base64();
    const res = await api<{ text: string }>("/v1/chat/transcribe", { method: "POST", body: JSON.stringify({ audio, mimeType: "audio/mp4" }) });
    return res.text.trim();
  }

  return { start, stop };
}

let voiceLang: string | null = null;

async function pickVoiceLang(): Promise<string | undefined> {
  if (voiceLang) return voiceLang;
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const has = (prefix: string) => voices.some((v) => v.language?.toLowerCase().startsWith(prefix));
    voiceLang = has("ne") ? "ne-NP" : has("hi") ? "hi-IN" : null;
  } catch {
    voiceLang = null;
  }
  return voiceLang ?? undefined;
}

export async function speak(text: string, lang: "ne" | "en") {
  Speech.stop();
  Speech.speak(text, { language: lang === "en" ? "en-US" : await pickVoiceLang(), rate: 0.92 });
}

export function stopSpeaking() {
  Speech.stop();
}
