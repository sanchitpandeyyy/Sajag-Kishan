import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, ErrorText, Loading } from "@/components/ui";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { useData } from "@/lib/use-data";
import { theme } from "@/theme";

interface Crop {
  code: string;
  nameNe: string;
  nameEn: string;
}

export function CropPicker({ parcelId, visible, onClose, onSaved }: { parcelId: string; visible: boolean; onClose: () => void; onSaved: () => void }) {
  const { tr, lang } = useLang();
  const crops = useData<Crop[]>(visible ? "/v1/crops" : null);
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      await api("/v1/declarations", { method: "POST", body: JSON.stringify({ parcelId, cropCode: picked }) });
      setPicked(null);
      onSaved();
      onClose();
    } catch {
      setError(tr("सेभ हुन सकेन। फेरि प्रयास गर्नुहोस्।", "Could not save. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.head}>
          <Text style={styles.title}>{tr("यो मौसमको बाली", "Crop this season")}</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={tr("बन्द", "Close")}>
            <Ionicons name="close" size={30} color={theme.colors.ink} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.list}>
          {crops.loading && !crops.data ? <Loading /> : null}
          {crops.data?.map((c) => {
            const on = picked === c.code;
            return (
              <Pressable key={c.code} onPress={() => setPicked(c.code)} style={[styles.item, on && styles.itemOn]} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                <Text style={styles.itemText}>{lang === "ne" ? c.nameNe : c.nameEn}</Text>
                <Ionicons name={on ? "checkmark-circle" : "ellipse-outline"} size={28} color={on ? theme.colors.brand[800] : theme.colors.line} />
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={styles.foot}>
          {error ? <ErrorText>{error}</ErrorText> : null}
          <Button title={tr("सेभ गर्नुहोस्", "Save")} onPress={save} busy={busy} disabled={!picked} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.page },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: theme.space.lg },
  title: { fontFamily: theme.font.heading, ...theme.type.h1, color: theme.colors.ink },
  list: { paddingHorizontal: theme.space.lg, gap: theme.space.md, paddingBottom: theme.space.lg },
  item: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.space.xl,
    backgroundColor: theme.colors.white,
    borderRadius: theme.radii.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.line,
  },
  itemOn: { borderColor: theme.colors.brand[800] },
  itemText: { fontFamily: theme.font.headingMedium, ...theme.type.h2, color: theme.colors.ink },
  foot: { padding: theme.space.lg, gap: theme.space.sm, borderTopWidth: 1, borderTopColor: theme.colors.line, backgroundColor: theme.colors.white },
});
