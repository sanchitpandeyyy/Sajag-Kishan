"use client";

import type { LucideIcon } from "lucide-react";
import { BellRing, FileBarChart, HandCoins, Landmark, LayoutDashboard, LogOut, Map, ShieldCheck, Upload, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/brand";
import { buttonClass } from "@/components/ui";
import { signOut } from "@/lib/auth-client";
import { LangToggle, ROLE_LABEL, useLang } from "@/lib/i18n";
import { useApi } from "@/lib/use-api";

const NAV = [
  { href: "/dashboard", icon: LayoutDashboard, ne: "ड्यासबोर्ड", en: "Dashboard" },
  { href: "/map", icon: Map, ne: "कृषि नक्सा", en: "KrishiMap" },
  { href: "/national", icon: Landmark, ne: "राष्ट्रिय तथ्याङ्क", en: "National data" },
  { href: "/farmers", icon: Users, ne: "कृषक र खाता", en: "Farmers & accounts" },
  { href: "/subsidy", icon: HandCoins, ne: "अनुदान वितरण", en: "Subsidy" },
  { href: "/alerts", icon: BellRing, ne: "सूचना / चेतावनी", en: "Alerts & advisories" },
  { href: "/import", icon: Upload, ne: "दर्ता आयात", en: "Registry import" },
  { href: "/reports", icon: FileBarChart, ne: "प्रतिवेदन", en: "Reports" },
  { href: "/officers", icon: ShieldCheck, ne: "कृषि अधिकृतहरू", en: "Officers", adminOnly: true },
] as const;

export interface Me {
  phoneNumber: string | null;
  role: "FARMER" | "AGRICULTURE_OFFICER" | "SUPER_ADMIN" | null;
  mustChangePassword: boolean;
  officer: { fullName: string; designation: string | null; localLevelId: number; localLevel: { nameNe: string; nameEn: string } | null } | null;
}

export function useMe() {
  return useApi<Me>("/v1/me");
}

export function Shell({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname();
  const { tr } = useLang();
  const { data: me } = useMe();
  const nav = NAV.filter((n) => !("adminOnly" in n) || me?.role === "SUPER_ADMIN");

  if (me?.mustChangePassword && typeof window !== "undefined") window.location.href = "/login?change=1";

  async function logout() {
    await signOut().catch(() => undefined);
    window.location.href = "/";
  }

  const roleLabel = me?.role && me.role in ROLE_LABEL ? ROLE_LABEL[me.role] : null;

  return (
    <div className="flex min-h-dvh bg-page">
      <aside className="no-print sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-1 bg-brand-800 px-3 py-5 text-white md:flex">
        <Link href="/dashboard" className="mb-6 px-2">
          <BrandMark onDark size={36} subtitle={tr("कृषि शाखा", "Agriculture office")} />
        </Link>
        {nav.map(({ href, icon: Icon, ne, en }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-control px-3 text-[15px] ${active ? "bg-white/15 font-semibold text-white" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
            >
              <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
              {tr(ne, en)}
            </Link>
          );
        })}
        <div className="mt-auto flex flex-col gap-4 px-2">
          <LangToggle tone="dark" />
          <div className="border-t border-white/15 pt-4 text-small">
            <p className="font-semibold">{me?.officer?.fullName ?? ""}</p>
            <p className="text-white/75">{me?.officer?.designation ?? (roleLabel ? tr(roleLabel[0], roleLabel[1]) : "")}</p>
            {me?.officer?.localLevel && <p className="text-white/75">{tr(me.officer.localLevel.nameNe, me.officer.localLevel.nameEn)}</p>}
            <button onClick={logout} className="mt-3 flex items-center gap-2 font-semibold text-white/85 hover:text-white">
              <LogOut className="size-4" /> {tr("बाहिर निस्कनुहोस्", "Sign out")}
            </button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-10">
        <div className="mx-auto max-w-[1200px]">
        <div className="no-print mb-4 flex items-center justify-between gap-2 md:hidden">
          <BrandMark size={30} />
          <LangToggle />
        </div>
        <nav className="no-print -mx-4 mb-6 flex overflow-x-auto border-b border-line px-4 md:hidden">
          {nav.map(({ href, ne, en }) => (
            <Link
              key={href}
              href={href}
              className={`shrink-0 border-b-2 px-3 py-3 text-small font-semibold ${pathname.startsWith(href) ? "border-brand-800 text-ink" : "border-transparent text-muted"}`}
            >
              {tr(ne, en)}
            </Link>
          ))}
          <button onClick={logout} className="shrink-0 px-3 py-3 text-small font-semibold text-muted">
            {tr("बाहिर", "Sign out")}
          </button>
        </nav>
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            {subtitle && <p className="text-small text-muted">{subtitle}</p>}
            <h1 className="font-heading text-h1 text-ink">{title}</h1>
          </div>
          <div className="no-print">{action}</div>
        </header>
        {children}
        </div>
      </main>
    </div>
  );
}

export function Glyph({ icon: Icon, className = "size-6" }: { icon: LucideIcon; className?: string }) {
  return <Icon className={`${className} shrink-0 text-brand-700`} strokeWidth={1.75} aria-hidden />;
}

export function Card({ title, icon, children, className = "", action }: { title?: string; icon?: LucideIcon; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <section className={`min-w-0 rounded-card border border-line bg-white p-5 shadow-card md:p-6 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && (
            <h2 className="flex items-center gap-2.5 font-heading text-h3 text-ink">
              {icon && <Glyph icon={icon} />}
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={buttonClass("primary", "md", props.className ?? "")}
    />
  );
}

export function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={buttonClass("secondary", "md", props.className ?? "")}
    />
  );
}

export function StateMessage({ loading, error }: { loading?: boolean; error?: string | null }) {
  const { tr } = useLang();
  if (loading) return <p className="text-small text-muted">{tr("लोड हुँदैछ", "Loading")}</p>;
  if (error) return <p className="text-small font-medium text-danger">{error}</p>;
  return null;
}

export const inputClass = "block min-h-12 w-full rounded-control border-[1.5px] border-input-border bg-white px-4 text-base text-ink focus:border-brand-700 focus:outline-none";
