import type { LucideIcon } from "lucide-react";

/** Icon tile colours: a soft tint behind a darker icon of the same hue. */
export const TONES = {
  blue: { bg: "#E9EFFB", fg: "#1d4fa8" },
  green: { bg: "#E4F2EA", fg: "#1f7a4d" },
  brown: { bg: "#F7E9E3", fg: "#8a4a2f" },
  teal: { bg: "#E3F2F6", fg: "#1b7a95" },
  gold: { bg: "#FBF1D3", fg: "#a77300" },
} as const;

export type Tone = keyof typeof TONES;

/**
 * KPI tile: icon on the left, then label, big number and a small note.
 * Farmers and officers read the icon first, so every figure gets one.
 */
export function StatTile({ icon: Icon, tone, label, value, note }: { icon: LucideIcon; tone: Tone; label: string; value: string; note?: string }) {
  const t = TONES[tone];
  return (
    <div className="flex min-w-0 items-start gap-4 rounded-card border border-line bg-white p-5 shadow-card">
      <span className="grid size-14 shrink-0 place-items-center rounded-card" style={{ background: t.bg, color: t.fg }}>
        <Icon className="size-7" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-small font-medium text-body">{label}</p>
        <p className="font-heading text-h1 leading-tight text-ink">{value}</p>
        {note ? <p className="mt-0.5 text-caption text-muted">{note}</p> : null}
      </div>
    </div>
  );
}
