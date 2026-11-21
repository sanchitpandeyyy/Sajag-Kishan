"use client";

import Link from "next/link";
import { BrandMark } from "@/components/brand";
import { LoginForm } from "@/components/login-form";
import { LangToggle, useLang } from "@/lib/i18n";

/** Standalone sign in (used by redirects such as ?next= and ?change=1). The landing page has the same form. */
export default function LoginPage() {
  const { tr } = useLang();
  return (
    <div className="grid min-h-dvh place-items-center bg-surface-muted p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/">
            <BrandMark subtitle={tr("कृषि शाखा पोर्टल", "Agriculture office portal")} />
          </Link>
          <LangToggle />
        </div>
        <div className="rounded-2xl border border-line bg-white p-8 shadow-sm">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
