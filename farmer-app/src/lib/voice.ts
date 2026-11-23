import { File } from "expo-file-system";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from "expo-audio";
import * as Speech from "expo-speech";
import { useRef } from "react";
import { api } from "./api";

/** A tap shorter than this, or a file smaller than this, holds no speech worth sending. */
const MIN_RECORDING_MS = 800;
const MIN_AUDIO_BYTES = 1024;

export function useNepaliRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const active = useRef(false);
  const startedAt = useRef(0);

  async function start(): Promise<boolean> {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) return false;
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    startedAt.current = Date.now();
    active.current = true;
    return true;
  }

  /** Returns "" when nothing usable was recorded, so the screen can ask the farmer to speak again. */
  async function stop(): Promise<string> {
    if (!active.current) return "";
    active.current = false;
    const tooShort = Date.now() - startedAt.current < MIN_RECORDING_MS;
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    if (tooShort) return "";
    const uri = recorder.uri ?? recorder.getStatus().url;
    if (!uri) return "";
    const file = new File(uri);
    if (!file.exists || (file.size ?? 0) < MIN_AUDIO_BYTES) return "";
    const audio = await file.base64();
    if (!audio) return "";
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
