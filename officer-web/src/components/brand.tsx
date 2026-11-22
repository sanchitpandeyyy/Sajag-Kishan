"use client";

import Image from "next/image";
import { useLang } from "@/lib/i18n";

/** Sajag Kishan logo + wordmark. `onDark` for the green sidebar (logo sits on a white disc). */
export function BrandMark({ onDark = false, size = 40, subtitle }: { onDark?: boolean; size?: number; subtitle?: string }) {
  const { tr } = useLang();
  return (
    <span className="flex items-center gap-2">
      <span className={`grid shrink-0 place-items-center rounded-full ${onDark ? "bg-white p-1 shadow-sm" : ""}`} style={{ width: size + (onDark ? 8 : 0), height: size + (onDark ? 8 : 0) }}>
        <Image src="/logo.png" alt="" width={size} height={size} priority />
      </span>
      <span className="leading-tight">
        <span className={`block font-heading text-xl font-bold ${onDark ? "text-white" : "text-brand-800"}`}>{tr("सजग किसान", "Sajag Kishan")}</span>
        {subtitle && <span className={`block text-xs ${onDark ? "text-white/80" : "text-ink-muted"}`}>{subtitle}</span>}
      </span>
    </span>
  );
}
