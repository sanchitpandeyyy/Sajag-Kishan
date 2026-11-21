/**
 * Ask: talk to the farming helper in Nepali. One big mic button, a few starter questions,
 * answers read aloud. Answers come from the farmer's own data and reviewed knowledge.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { type ComponentRef, useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrandRow, LangSwitch } from "@/components/ui";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { speakRepliesEnabled } from "@/lib/prefs";
import { speak, stopSpeaking, useNepaliRecorder } from "@/lib/voice";
import { theme } from "@/theme";

const c = theme.colors;

interface Turn {
  role: "user" | "assistant";
  text: string;
  textEn?: string;
}
interface ChatAnswer {
  answerNe: string;
  answerEn: string;
  understoodEn: string;
  mode: "llm" | "local";
}
interface Suggestions {
  suggestions: { ne: string; en: string }[];
}

export default function Ask() {
  const { tr, lang } = useLang();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorder = useNepaliRecorder();
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<{ ne: string; en: string }[]>([]);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);

  useEffect(() => {
    api<Suggestions>("/v1/chat/suggestions")
      .then((s) => setSuggestions(s.suggestions))
      .catch(() => undefined);
    return () => stopSpeaking();
  }, []);

  useEffect(() => {
    if (!listening) return;
    const id = setInterval(() => setSeconds((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [listening]);

  async function send(message: string, spoken = false) {
    const q = message.trim();
    if (!q || busy) return;
    setError(null);
    setText("");
    const history = turns.map((t) => ({ role: t.role, text: t.text }));
    setTurns((t) => [...t, { role: "user", text: q }]);
    setBusy(true);
    try {
      const a = await api<ChatAnswer>("/v1/chat", { method: "POST", body: JSON.stringify({ message: q, history }) });
      setTurns((t) => [...t, { role: "assistant", text: a.answerNe, textEn: a.answerEn }]);
      if (spoken && (await speakRepliesEnabled())) void speak(lang === "en" ? a.answerEn : a.answerNe, lang);
    } catch {
      setError(tr("जवाफ आउन सकेन। इन्टरनेट जाँच्नुहोस्।", "Could not get an answer. Check the internet."));
    } finally {
      setBusy(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }

  async function mic() {
    stopSpeaking();
    setError(null);
    if (transcribing) return;
    if (listening) {
      setListening(false);
      setTranscribing(true);
      try {
        const heard = await recorder.stop();
        if (heard) {
          // Send what was heard straight away; the answer is then read aloud.
          setTranscribing(false);
          void send(heard, true);
        } else {
          setError(tr("आवाज सुनिएन। फेरि बोल्नुहोस्।", "Did not hear anything. Please try again."));
        }
      } catch (e) {
        setError(`${tr("आवाज बुझ्न सकिएन।", "Could not understand the voice.")} ${e instanceof Error ? e.message : ""}`.trim());
      } finally {
        setTranscribing(false);
      }
      return;
    }
    try {
      const ok = await recorder.start();
      if (!ok) {
        setError(tr("माइक अनुमति दिनुहोस्।", "Please allow the microphone."));
        return;
      }
      setSeconds(0);
      setListening(true);
    } catch (e) {
      setError(`${tr("माइक खुल्न सकेन।", "Could not start the microphone.")} ${e instanceof Error ? e.message : ""}`.trim());
    }
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <View style={styles.header}>
          <BrandRow right={<LangSwitch />} />
          <Text style={styles.title}>{tr("सोध्नुहोस्", "Ask")}</Text>
        </View>

        <ScrollView ref={scrollRef} contentContainerStyle={styles.thread} keyboardShouldPersistTaps="handled">
          {turns.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.helperIcon}>
                <Ionicons name="chatbubbles" size={34} color={c.brand[800]} />
              </View>
              <Text style={styles.emptyTitle}>{tr("खेतीबारे जे पनि सोध्नुहोस्", "Ask anything about your farm")}</Text>
              <Text style={styles.emptyBody}>{tr("माइक थिचेर नेपालीमा बोल्नुहोस्।", "Tap the mic and speak in Nepali.")}</Text>
              <View style={styles.chips}>
                {suggestions.map((s) => (
                  <Pressable key={s.ne} onPress={() => send(lang === "en" ? s.en : s.ne)} style={({ pressed }) => [styles.chip, pressed && { opacity: 0.8 }]} accessibilityRole="button">
                    <Text style={styles.chipText}>{lang === "en" ? s.en : s.ne}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            turns.map((t, i) => (
              <View key={i} style={[styles.bubble, t.role === "user" ? styles.userBubble : styles.botBubble]}>
                <Text style={[styles.bubbleText, t.role === "user" && { color: c.white }]}>{lang === "en" && t.textEn ? t.textEn : t.text}</Text>
                {t.role === "assistant" ? (
                  <Pressable onPress={() => speak(lang === "en" && t.textEn ? t.textEn : t.text, lang)} hitSlop={10} style={styles.speakBtn} accessibilityLabel={tr("सुन्नुहोस्", "Listen")}>
                    <Ionicons name="volume-high" size={20} color={c.brand[800]} />
                    <Text style={styles.speakText}>{tr("सुन्नुहोस्", "Listen")}</Text>
                  </Pressable>
                ) : null}
              </View>
            ))
          )}
          {busy || transcribing ? (
            <View style={[styles.bubble, styles.botBubble, { flexDirection: "row", gap: 8, alignItems: "center" }]}>
              <ActivityIndicator color={c.brand[800]} />
              <Text style={styles.speakText}>{transcribing ? tr("सुन्दै...", "Understanding your voice") : tr("सोच्दै...", "Thinking")}</Text>
            </View>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>

        {listening ? (
          <View style={styles.recBar}>
            <View style={styles.recDot} />
            <Text style={styles.recText}>{tr(`रेकर्ड हुँदैछ ${seconds} सेकेन्ड। बोल्नुहोस्, सकिएपछि रातो बटन थिच्नुहोस्।`, `Recording ${seconds}s. Speak, then tap the red button.`)}</Text>
          </View>
        ) : null}
        <View style={styles.composer}>
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={setText}
            placeholder={listening ? tr("बोल्दै गर्नुहोस्, सकिएपछि रोक्नुहोस्", "Speak, then tap stop") : tr("यहाँ लेख्नुहोस्", "Type here")}
            placeholderTextColor={c.inkMuted}
            style={styles.input}
            multiline
            onSubmitEditing={() => send(text)}
          />
          {text.trim() && !listening && !transcribing ? (
            <Pressable onPress={() => send(text)} style={[styles.round, styles.sendBtn]} accessibilityLabel={tr("पठाउनुहोस्", "Send")}>
              <Ionicons name="send" size={24} color={c.white} />
            </Pressable>
          ) : (
            <Pressable
              onPress={mic}
              disabled={transcribing}
              style={[styles.round, listening ? styles.micOn : styles.micBtn]}
              accessibilityLabel={transcribing ? tr("आवाज बुझ्दै", "Understanding your voice") : tr("बोल्नुहोस्", "Speak")}
              accessibilityState={{ busy: transcribing }}
            >
              {transcribing ? <ActivityIndicator size="large" color={c.brand[900]} /> : <Ionicons name={listening ? "stop" : "mic"} size={30} color={listening ? c.white : c.brand[900]} />}
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.page },
  header: { gap: theme.space.sm, paddingHorizontal: theme.space.lg, paddingBottom: theme.space.sm },
  title: { fontFamily: theme.font.heading, ...theme.type.h1, color: c.ink },
  thread: { padding: theme.space.lg, gap: 12, flexGrow: 1 },
  empty: { alignItems: "center", gap: 10, paddingTop: 24 },
  helperIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: c.fill, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontFamily: theme.font.heading, ...theme.type.h2, color: c.ink, textAlign: "center" },
  emptyBody: { fontFamily: theme.font.body, ...theme.type.body, color: c.inkMuted, textAlign: "center" },
  chips: { width: "100%", gap: 10, marginTop: 12 },
  chip: { minHeight: 52, justifyContent: "center", paddingHorizontal: 16, borderRadius: theme.radii.lg, borderWidth: 1, borderColor: c.line, backgroundColor: c.white },
  chipText: { fontFamily: theme.font.bodyBold, ...theme.type.body, color: c.ink },
  bubble: { maxWidth: "88%", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 18, gap: 8 },
  userBubble: { alignSelf: "flex-end", backgroundColor: c.brand[800], borderBottomRightRadius: 6 },
  botBubble: { alignSelf: "flex-start", backgroundColor: c.white, borderWidth: 1, borderColor: c.line, borderBottomLeftRadius: 6 },
  bubbleText: { fontFamily: theme.font.body, fontSize: 18, lineHeight: 28, color: c.ink },
  speakBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", minHeight: 32 },
  speakText: { fontFamily: theme.font.bodyBold, fontSize: 15, color: c.brand[800] },
  error: { fontFamily: theme.font.bodyBold, ...theme.type.small, color: c.danger, textAlign: "center" },
  recBar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: theme.space.lg, paddingVertical: 10, backgroundColor: c.fill },
  recDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: c.danger },
  recText: { flex: 1, fontFamily: theme.font.bodyBold, fontSize: 15, color: c.ink },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: theme.space.lg, paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.line, backgroundColor: c.white },
  input: { flex: 1, minHeight: 56, maxHeight: 120, borderRadius: 28, borderWidth: 1, borderColor: c.line, backgroundColor: c.page, paddingHorizontal: 18, paddingTop: 15, paddingBottom: 15, fontFamily: theme.font.body, fontSize: 18, color: c.ink },
  round: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  micBtn: { backgroundColor: c.accent },
  micOn: { backgroundColor: c.danger },
  sendBtn: { backgroundColor: c.brand[800] },
});
