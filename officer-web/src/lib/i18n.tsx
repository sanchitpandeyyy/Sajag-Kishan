"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Lang = "ne" | "en";
const STORAGE_KEY = "sajagkishan.lang";
const DEVANAGARI_DIGITS = "०१२३४५६७८९";

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  tr: (ne: string, en: string) => string;
  num: (n: number, maxFractionDigits?: number) => string;
}

const LangContext = createContext<LangContextValue | null>(null);

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ne");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "ne") setLangState(saved);
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {}
  }, []);

  const value = useMemo<LangContextValue>(
    () => ({
      lang,
      setLang,
      tr: (ne, en) => (lang === "ne" ? ne : en),
      num: (n, maxFractionDigits = 2) => {
        const s = n.toLocaleString("en-IN", { maximumFractionDigits: maxFractionDigits });
        return lang === "ne" ? s.replace(/[0-9]/g, (d) => DEVANAGARI_DIGITS[Number(d)]!) : s;
      },
    }),
    [lang, setLang],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used inside <LangProvider>");
  return ctx;
}

export function LangToggle({ tone = "light" }: { tone?: "light" | "dark" }) {
  const { lang, setLang } = useLang();
  const dark = tone === "dark";
  const track = dark ? "bg-white/12 ring-1 ring-inset ring-white/20" : "bg-fill ring-1 ring-inset ring-line";
  const thumb = dark ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)]" : "bg-brand-800 shadow-[0_1px_3px_rgba(7,84,38,0.35)]";
  const on = dark ? "text-brand-900" : "text-white";
  const off = dark ? "text-white/75 hover:text-white" : "text-muted hover:text-ink";
  return (
    <div role="group" aria-label="Language / भाषा" className={`relative inline-grid grid-cols-2 rounded-full p-1 text-caption font-bold tracking-[0.06em] ${track}`}>
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${thumb}`}
        style={{ transform: lang === "en" ? "translateX(100%)" : "translateX(0)" }}
      />
      {(
        [
          ["ne", "NP", "नेपाली"],
          ["en", "EN", "English"],
        ] as const
      ).map(([code, label, full]) => (
        <button
          key={code}
          type="button"
          lang={code}
          title={full}
          aria-label={full}
          aria-pressed={lang === code}
          onClick={() => setLang(code)}
          className={`relative z-10 min-h-8 min-w-11 rounded-full px-3 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${lang === code ? on : off}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export const SEASON_LABEL = {
  BARSHE: ["बर्खे", "Monsoon"],
  HIUDE: ["हिउँदे", "Winter"],
  CHAITE: ["चैते", "Spring"],
} as const;

export const ROLE_LABEL = {
  FARMER: ["कृषक", "Farmer"],
  AGRICULTURE_OFFICER: ["कृषि अधिकृत", "Agriculture officer"],
  SUPER_ADMIN: ["सुपर एडमिन", "Super admin"],
} as const;
