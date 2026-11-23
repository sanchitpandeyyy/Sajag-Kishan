import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Lang = "ne" | "en";
const KEY = "sajagkishan.lang";
const DEVANAGARI = "०१२३४५६७८९";

interface LangValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  tr: (ne: string, en: string) => string;
  num: (n: number, maxFractionDigits?: number) => string;
}

const Ctx = createContext<LangValue | null>(null);

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ne");

  useEffect(() => {
    SecureStore.getItemAsync(KEY)
      .then((v) => (v === "en" || v === "ne" ? setLangState(v) : undefined))
      .catch(() => undefined);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    void SecureStore.setItemAsync(KEY, l).catch(() => undefined);
  }, []);

  const value = useMemo<LangValue>(
    () => ({
      lang,
      setLang,
      tr: (ne, en) => (lang === "ne" ? ne : en),
      num: (n, d = 2) => {
        const s = n.toLocaleString("en-IN", { maximumFractionDigits: d });
        return lang === "ne" ? s.replace(/[0-9]/g, (x) => DEVANAGARI[Number(x)]!) : s;
      },
    }),
    [lang, setLang],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLang(): LangValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLang must be used inside <LangProvider>");
  return v;
}

export const CROP_EN: Record<string, string> = {
  paddy: "Paddy",
  wheat: "Wheat",
  maize: "Maize",
  potato: "Potato",
  mustard: "Mustard",
  lentil: "Lentil",
  millet: "Finger millet",
};
