"use client";

import Link from "next/link";
import { BrandMark } from "@/components/brand";
import { ButtonLink } from "@/components/ui";
import { isOfficerRole, useSession } from "@/lib/auth-client";
import { LangToggle, useLang } from "@/lib/i18n";

export function PublicFrame({ title, subtitle, action, crumbs, children }: { title: string; subtitle?: string; action?: React.ReactNode; crumbs?: React.ReactNode; children: React.ReactNode }) {
  const { tr } = useLang();
  const { data: session } = useSession();
  const signedIn = !!session?.user && isOfficerRole((session.user as { role?: string }).role);

  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <header className="sticky top-0 z-40 border-b border-line bg-white px-4 md:px-8">
        <div className="mx-auto flex min-h-[72px] max-w-[1200px] items-center gap-2">
          <Link href="/" aria-label={tr("कृषि दृष्टि गृहपृष्ठ", "Krishi Dristi home")} className="mr-2 lg:mr-6">
            <BrandMark size={36} />
          </Link>
          <nav aria-label={tr("साइट", "Site")} className="hidden items-center gap-1 sm:flex">
            <Link href="/" className="inline-flex min-h-12 items-center rounded-control px-3 font-medium text-body hover:bg-page">
              {tr("गृहपृष्ठ", "Home")}
            </Link>
            <Link href="/national" aria-current="page" className="inline-flex min-h-12 items-center rounded-control px-3 font-semibold text-ink">
              {tr("राष्ट्रिय तथ्याङ्क", "National data")}
            </Link>
          </nav>
          <div className="min-w-0 flex-1" />
          <LangToggle />
          {signedIn ? (
            <ButtonLink href="/dashboard" variant="brand">
              {tr("ड्यासबोर्ड", "Dashboard")}
            </ButtonLink>
          ) : (
            <ButtonLink href="/#signin" variant="brand">
              {tr("लगइन", "Sign in")}
            </ButtonLink>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-8 md:px-8 md:py-10">
        {crumbs}
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            {subtitle && <p className="text-small text-muted">{subtitle}</p>}
            <h1 className="font-heading text-h1 text-ink">{title}</h1>
          </div>
          <div>{action}</div>
        </header>
        {children}
      </main>
    </div>
  );
}
