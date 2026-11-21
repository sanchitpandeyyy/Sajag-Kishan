"use client";

import { ArrowRight, CloudRain } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { BrandMark } from "@/components/brand";
import { ButtonA } from "@/components/ui";
import { LangToggle, useLang } from "@/lib/i18n";
import { unsplashLoader } from "@/lib/unsplash-loader";
import { useLandingMotion } from "@/lib/use-landing-motion";

const PLOWING = "https://images.unsplash.com/photo-1764292869846-f54b1786cc65";

const rise = {
  hidden: { opacity: 0, y: 18 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: 0.08 * i, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } }),
};

export default function Landing() {
  const { tr, num, lang } = useLang();
  const root = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  useLandingMotion(root, (n) => num(n, 0), [lang]);
  const enter = (i: number) => (reduce ? {} : { variants: rise, initial: "hidden" as const, animate: "show" as const, custom: i });

  return (
    <div ref={root} className="flex min-h-dvh flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-line bg-white px-4 md:px-8">
        <div className="mx-auto flex min-h-[72px] max-w-[1200px] items-center gap-2">
          <Link href="/" aria-label={tr("सजग किसान गृहपृष्ठ", "Sajag Kishan home")} className="mr-2 lg:mr-6">
            <BrandMark size={36} />
          </Link>
          <nav aria-label={tr("साइट", "Site")} className="hidden items-center gap-1 lg:flex">
            {[
              ["#features", tr("के गर्छ", "What it does")],
              ["#how", tr("कसरी काम गर्छ", "How it works")],
            ].map(([href, label]) => (
              <a key={href} href={href} className="inline-flex min-h-12 items-center rounded-control px-3 font-medium text-body hover:bg-page">
                {label}
              </a>
            ))}
            <Link href="/national" className="inline-flex min-h-12 items-center rounded-control px-3 font-medium text-body hover:bg-page">
              {tr("राष्ट्रिय तथ्याङ्क", "National data")}
            </Link>
          </nav>
          <div className="min-w-0 flex-1" />
          <LangToggle />
          <div className="hidden sm:block">
            <ButtonA href="#signin" variant="brand">
              {tr("लगइन", "Sign in")}
            </ButtonA>
          </div>
        </div>
      </header>

      <main className="flex flex-col">
        <section className="bg-white px-4 pt-14 pb-16 md:px-8 md:pt-20 md:pb-24">
          <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-6 text-center">
            <motion.div {...enter(0)}>
              <Image src="/logo.png" alt="" width={112} height={112} priority className="size-24 md:size-28" />
            </motion.div>
            <motion.h1 {...enter(1)} className="max-w-[900px] font-heading text-display text-ink md:text-hero">
              {tr("हरेक खेतको सही जानकारी, हरेक किसानलाई सही सहयोग।", "Know every field. Support every farmer.")}
            </motion.h1>
            <motion.p {...enter(2)} className="max-w-[640px] text-lead text-body">
              {tr(
                "सजग किसानले पालिकाको कृषि शाखालाई जग्गा, बाली र अनुदानको स्पष्ट जानकारी दिन्छ, र किसानलाई कहिले के गर्ने भन्ने पात्रो।",
                "Sajag Kishan gives municipal agriculture offices a clear view of land, crops and subsidy, and gives farmers a calendar of what to do and when.",
              )}
            </motion.p>
            <motion.div {...enter(3)} className="mt-2 flex w-full flex-wrap items-center justify-center gap-3">
              <ButtonA href="#signin" size="lg" className="w-full sm:w-auto">
                {tr("कृषि शाखा लगइन", "Agriculture office sign in")} <ArrowRight className="size-5" />
              </ButtonA>
              <ButtonA href="#how" variant="secondary" size="lg" className="w-full sm:w-auto">
                {tr("कसरी काम गर्छ", "See how it works")}
              </ButtonA>
            </motion.div>
          </div>

          <motion.figure
            {...(reduce ? {} : { initial: { opacity: 0, y: 32 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.35, duration: 0.8, ease: [0.22, 1, 0.36, 1] as const } })}
            className="relative mx-auto mt-12 aspect-[16/9] w-full max-w-[1200px] overflow-hidden rounded-panel bg-fill shadow-raised md:mt-16 md:aspect-[21/9]"
          >
            <div data-parallax="0.16" className="absolute inset-x-0 -inset-y-[10%]">
              <Image
                src={PLOWING}
                loader={unsplashLoader}
                alt={tr("गोरखामा गोरु जोतेर गरा तयार गर्दै किसान", "A farmer plowing terraced fields with oxen in Gorkha, Nepal")}
                fill
                priority
                sizes="(min-width: 1200px) 1200px, 100vw"
                className="object-cover"
              />
            </div>
            <figcaption className="absolute right-4 bottom-4 left-4 flex md:right-6 md:bottom-6 md:left-6">
              <div className="max-w-[420px] rounded-card bg-white p-4 text-left shadow-card md:p-5">
                <p className="flex items-center gap-2 text-small font-semibold text-ink">
                  <CloudRain className="size-4 text-info" aria-hidden /> {tr("गोरखा: आगामी १० दिन", "Gorkha: next 10 days")}
                </p>
                <p className="mt-1 text-small text-body">
                  {tr("वर्षा कम हुने देखिन्छ। रोपाइँअघि सिँचाइको योजना बनाउनुहोस्।", "Little rain expected. Plan irrigation before transplanting.")}
                </p>
              </div>
            </figcaption>
          </motion.figure>
        </section>
      </main>
    </div>
  );
}
