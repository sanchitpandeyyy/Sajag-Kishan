"use client";

import { ArrowRight, BadgeCheck, Bug, CalendarDays, ClipboardCheck, CloudRain, FileText, HandCoins, LandPlot, Landmark, Map, MapPin, Upload, Users } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { BrandMark } from "@/components/brand";
import { LoginForm } from "@/components/login-form";
import { Loader } from "@/components/shell";
import { ButtonA, ButtonLink, Section, SectionHead } from "@/components/ui";
import { isOfficerRole, useSession } from "@/lib/auth-client";
import { LangToggle, useLang } from "@/lib/i18n";
import { NATIONAL_KPIS, NATIONAL_SOURCE } from "@/lib/national-data";
import { unsplashLoader } from "@/lib/unsplash-loader";
import { useLandingMotion } from "@/lib/use-landing-motion";

const PHOTOS = {
  plowing: {
    src: "https://images.unsplash.com/photo-1764292869846-f54b1786cc65",
    by: "BLOG REGION",
    page: "https://unsplash.com/photos/farmer-plows-rice-field-with-oxen-on-terraced-hillside-fiRKEmZoocQ",
  },
  farmer: {
    src: "https://images.unsplash.com/photo-1781397972640-0b1c14fa7c93",
    by: "BLOG REGION",
    page: "https://unsplash.com/photos/an-elderly-man-wearing-a-traditional-hat-in-a-cornfield-kBsgDulA7e8",
  },
  terraces: {
    src: "https://images.unsplash.com/photo-1754976645463-df5faa0a385a",
    by: "Sushanta Rokka",
    page: "https://unsplash.com/photos/lush-green-rice-terraces-on-a-hillside-xYVnQ5xdWVE",
  },
} as const;

const rise = {
  hidden: { opacity: 0, y: 18 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: 0.08 * i, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } }),
};

export default function Landing() {
  const { tr, num, lang } = useLang();
  const { data: session, isPending } = useSession();
  const root = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  useLandingMotion(root, (n) => num(n, 0), [lang]);
  const enter = (i: number) => (reduce ? {} : { variants: rise, initial: "hidden" as const, animate: "show" as const, custom: i });
  const signedIn = !!session?.user && isOfficerRole((session.user as { role?: string }).role);

  const facts = [
    { n: NATIONAL_KPIS.households, icon: Users, label: tr("दर्ता भएका किसान घरधुरी", "registered farm households") },
    { n: NATIONAL_KPIS.verified, icon: BadgeCheck, label: tr("वडाबाट प्रमाणित किसान", "farmers verified by wards") },
    { n: Math.round(NATIONAL_KPIS.landHa), icon: LandPlot, label: tr("हेक्टर कृषि जग्गा दर्ता", "hectares of farmland registered") },
    { n: NATIONAL_KPIS.municipalities, icon: Landmark, label: tr("दर्ता भएका स्थानीय तह", "local levels in the registry") },
  ];

  const features = [
    {
      icon: Map,
      title: tr("जग्गा र बालीको नक्सा", "Land and crop map"),
      body: tr(
        "कुन वडामा कति जग्गा छ, कति खेती भयो र कति बाँझो छ, एकै नक्सामा हेर्नुहोस्।",
        "See how much land each ward has, how much is farmed and how much lies fallow, on one map.",
      ),
    },
    {
      icon: HandCoins,
      title: tr("न्यायोचित अनुदान", "Fair subsidy"),
      body: tr(
        "खेतीको क्षेत्र र बाली अनुसार मल, बीउ र यन्त्रको माग गणना गरी साना किसानलाई पहिले दिनुहोस्।",
        "Work out fertilizer, seed and machinery needs from real farming data, and serve small farmers first.",
      ),
    },
    {
      icon: CalendarDays,
      title: tr("किसानलाई पात्रो र सूचना", "Calendar and alerts"),
      body: tr(
        "किसानले आफ्नो ठाउँ र उचाइ अनुसार कहिले रोप्ने, मल हाल्ने र काट्ने पात्रो र मौसम सूचना मोबाइलमा पाउँछन्।",
        "Farmers get a planting, fertilizing and harvest calendar for their altitude, and weather alerts on their phone.",
      ),
    },
  ];

  const steps = [
    { icon: Upload, title: tr("किसान दर्ता आयात", "Import the registry"), body: tr("सरकारी दर्ताका किसान स्वतः प्रणालीमा आउँछन्।", "Farmers from the government registry are added automatically.") },
    { icon: MapPin, title: tr("खेत र बाली जनाउने", "Add fields and crops"), body: tr("किसानले मोबाइलबाट खेतको स्थान र यो मौसमको बाली जनाउँछन्।", "Farmers add field location and this season's crop from the mobile app.") },
    { icon: ClipboardCheck, title: tr("कृषि शाखाले प्रमाणित गर्छ", "Office verifies"), body: tr("खेत र विवरण जाँचेर प्रमाणित गरिन्छ।", "The agriculture office checks and verifies each field.") },
    { icon: FileText, title: tr("योजना र प्रतिवेदन", "Plan and report"), body: tr("अनुदान योजना, प्रतिवेदन, र किसानलाई पात्रो।", "Subsidy plans, government reports and farmer calendars.") },
  ];

  const mainCta = signedIn ? (
    <ButtonLink href="/dashboard" size="lg" className="w-full sm:w-auto">
      {tr("ड्यासबोर्ड खोल्नुहोस्", "Open dashboard")} <ArrowRight className="size-5" />
    </ButtonLink>
  ) : (
    <ButtonA href="#signin" size="lg" className="w-full sm:w-auto">
      {tr("कृषि शाखा लगइन", "Agriculture office sign in")} <ArrowRight className="size-5" />
    </ButtonA>
  );

  return (
    <div ref={root} className="flex min-h-dvh flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-line bg-white px-4 md:px-8">
        <div className="mx-auto flex min-h-[72px] max-w-[1200px] items-center gap-2">
          <Link href="/" aria-label={tr("कृषि दृष्टि गृहपृष्ठ", "Krishi Dristi home")} className="mr-2 lg:mr-6">
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
            {signedIn ? (
              <ButtonLink href="/dashboard" variant="brand">
                {tr("ड्यासबोर्ड", "Dashboard")}
              </ButtonLink>
            ) : (
              <ButtonA href="#signin" variant="brand">
                {tr("लगइन", "Sign in")}
              </ButtonA>
            )}
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
                "कृषि दृष्टिले पालिकाको कृषि शाखालाई जग्गा, बाली र अनुदानको स्पष्ट जानकारी दिन्छ, र किसानलाई कहिले के गर्ने भन्ने पात्रो।",
                "Krishi Dristi gives municipal agriculture offices a clear view of land, crops and subsidy, and gives farmers a calendar of what to do and when.",
              )}
            </motion.p>
            <motion.div {...enter(3)} className="mt-2 flex w-full flex-wrap items-center justify-center gap-3">
              {mainCta}
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
                src={PHOTOS.plowing.src} loader={unsplashLoader}
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

        <section aria-label={tr("अंकमा", "In numbers")} className="border-y border-line bg-white px-4 py-8 md:px-8 md:py-10">
          <dl className="mx-auto grid max-w-[1200px] grid-cols-2 gap-y-6 md:grid-cols-4">
            {facts.map((f, i) => (
              <div key={f.label} className={`flex flex-col items-center gap-1 px-4 ${i % 2 === 0 ? "border-r border-line" : ""} ${i < 3 ? "md:border-r md:border-line" : ""}`}>
                <f.icon className="mb-1 size-7 text-brand-700" strokeWidth={1.75} aria-hidden />
                <dd data-count={f.n} className="tnum font-heading text-h1 text-ink md:text-[44px] md:leading-[52px]">
                  {num(f.n, 0)}
                </dd>
                <dt className="text-center text-small text-muted">{f.label}</dt>
              </div>
            ))}
          </dl>
          <p className="mx-auto mt-6 max-w-[1200px] text-center text-caption text-muted">
            {tr(`स्रोत: कृषि तथा पशुपन्छी विकास मन्त्रालयको किसान सूचीकरण, ${NATIONAL_SOURCE.asOfBs}।`, `Source: Farmer Registry, Ministry of Agriculture and Livestock Development, ${NATIONAL_SOURCE.asOfEn}.`)}{" "}
            <Link href="/national" className="font-semibold text-brand-700 hover:underline">
              {tr("सबै तथ्याङ्क हेर्नुहोस्", "See all national data")}
            </Link>
          </p>
        </section>

        <Section id="features" className="bg-page" inner="gap-10 md:gap-14">
          <div data-reveal>
          <SectionHead
            eyebrow={tr("के गर्छ", "What it does")}
            title={tr("एउटै प्रणाली, कृषि शाखा र किसान दुवैका लागि", "One system for offices and farmers")}
            text={tr("दर्ता, नक्सा, अनुदान र पात्रो एकै ठाउँमा।", "Registry, map, subsidy and calendar in one place.")}
          />
          </div>
          <div data-stagger className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {features.map(({ icon: Icon, title, body }) => (
              <article key={title} className="lift flex flex-col gap-4 rounded-panel border border-line bg-white p-6 shadow-card md:p-8">
                <Icon className="size-8 text-brand-800" strokeWidth={1.75} aria-hidden />
                <h3 className="font-heading text-h2 text-ink">{title}</h3>
                <p className="text-body">{body}</p>
              </article>
            ))}
          </div>
        </Section>

        <Section id="how" className="bg-white" inner="gap-10 md:gap-14">
          <div data-reveal>
            <SectionHead eyebrow={tr("कसरी काम गर्छ", "How it works")} title={tr("दर्तादेखि योजनासम्म, चार चरणमा", "From registry to plan in four steps")} />
          </div>
          <ol data-stagger className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <li key={s.title} className="flex flex-col gap-3 border-t-2 border-ink pt-6">
                <div className="flex items-center justify-between">
                  <s.icon className="size-9 text-brand-800" strokeWidth={1.75} aria-hidden />
                  <span className="tnum font-heading text-h1 text-muted">{num(i + 1)}</span>
                </div>
                <h3 className="font-heading text-h3 text-ink">{s.title}</h3>
                <p className="text-body">{s.body}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section className="bg-page" inner="gap-10">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div data-reveal className="relative aspect-[4/3] overflow-hidden rounded-panel bg-fill shadow-card">
              <div data-scale-in className="absolute inset-0">
                <Image
                  src={PHOTOS.farmer.src} loader={unsplashLoader}
                  alt={tr("गोरखामा आफ्नो मकै बारी अगाडि उभिएका किसान", "A farmer in front of his cornfield in Gorkha, Nepal")}
                  fill
                  sizes="(min-width: 1024px) 600px, 100vw"
                  className="object-cover"
                />
              </div>
            </div>
            <div data-reveal className="flex flex-col items-start gap-5">
              <p className="text-small font-bold tracking-wide text-brand-700 uppercase">{tr("किसानका लागि", "For farmers")}</p>
              <h2 className="font-heading text-h1 text-ink md:text-display">{tr("आफ्नै खेतको पात्रो, आफ्नै भाषामा", "A calendar for their own field, in their own language")}</h2>
              <p className="text-lead text-body">
                {tr(
                  "किसानले मोबाइल एपमा आफ्नो खेत, उचाइ र बाली अनुसार कहिले रोप्ने, मल हाल्ने र काट्ने भन्ने पात्रो र मौसम तथा रोगको सूचना पाउँछन्।",
                  "In the mobile app, farmers see when to sow, fertilize and harvest for their field, altitude and crop, with weather and disease alerts.",
                )}
              </p>
              <ul className="flex w-full flex-col gap-3">
                {[
                  { icon: CloudRain, text: tr("भारी वर्षा, तुसारो र खडेरीको पूर्व सूचना", "Early warning for heavy rain, frost and dry spells") },
                  { icon: Bug, text: tr("डढुवा र मरुवा जस्ता रोगको जोखिम", "Risk of diseases such as late blight and rice blast") },
                  { icon: HandCoins, text: tr("आफूले पाएको अनुदान पारदर्शी रूपमा", "The subsidy they received, shown transparently") },
                  { icon: Users, text: tr("सरकारी दर्ताबाट स्वतः खाता, फेरि दर्ता गर्नु पर्दैन", "An account created from the government registry, no second sign up") },
                ].map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-center gap-4 border-t border-line pt-3 text-body">
                    <Icon className="size-7 shrink-0 text-brand-700" strokeWidth={1.75} aria-hidden />
                    {text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        <section id="signin" className="relative isolate overflow-hidden bg-brand-800 px-4 py-14 md:px-8 md:py-[88px]">
          <div aria-hidden className="absolute inset-0 -z-10">
            <div data-parallax="0.2" className="absolute inset-x-0 -inset-y-[12%]">
              <Image src={PHOTOS.terraces.src} loader={unsplashLoader} alt="" fill sizes="100vw" className="object-cover" />
            </div>
            <div className="absolute inset-0 bg-brand-900/85" />
          </div>
          <div data-reveal className="mx-auto grid max-w-[1200px] items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <SectionHead
              align="left"
              onDark
              eyebrow={tr("कृषि शाखाका लागि", "For agriculture offices")}
              title={tr("आफ्नो पालिकाको ड्यासबोर्डमा लगइन गर्नुहोस्", "Sign in to your municipality dashboard")}
              text={tr(
                "मोबाइल नम्बर र पासवर्ड प्रयोग गर्नुहोस्। खाता छैन भने सुपर एडमिनसँग सम्पर्क गर्नुहोस्। किसानले मोबाइल एप प्रयोग गर्नुहुन्छ।",
                "Use your mobile number and password. No account yet? Contact the super admin. Farmers use the mobile app.",
              )}
            />
            <div className="w-full max-w-[460px] justify-self-center rounded-panel bg-white p-6 shadow-raised md:p-8 lg:justify-self-end">
              {isPending ? (
                <Loader className="py-10" />
              ) : signedIn ? (
                <div className="flex flex-col items-center gap-5 py-6 text-center">
                  <p className="text-lead text-body">{tr("तपाईं लगइन हुनुहुन्छ।", "You are signed in.")}</p>
                  <ButtonLink href="/dashboard" size="lg">
                    {tr("ड्यासबोर्ड खोल्नुहोस्", "Open dashboard")} <ArrowRight className="size-5" />
                  </ButtonLink>
                </div>
              ) : (
                <LoginForm />
              )}
            </div>
          </div>
        </section>
      </main>

      <section id="farmer-app" aria-label={tr("किसानका लागि एप", "App for farmers")} className="border-t border-line bg-page px-4 py-14 md:px-8 md:py-20">
        <div data-reveal className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-8 rounded-panel bg-accent p-6 shadow-raised md:flex-row md:p-10">
          <div className="flex items-center gap-5">
            <span className="grid size-20 shrink-0 place-items-center rounded-card bg-white md:size-24">
              <Image src="/logo.png" alt="" width={72} height={72} className="size-14 md:size-[72px]" />
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="font-heading text-h2 text-ink md:text-h1">{tr("किसानका लागि कृषि दृष्टि एप", "The Krishi Dristi app for farmers")}</h2>
              <p className="text-lead text-ink/80">{tr("पात्रो, मौसम सूचना र अलार्म, आफ्नै भाषामा, एन्ड्रोइड फोनमा।", "Calendar, weather alerts and reminders, in Nepali, on Android phones.")}</p>
            </div>
          </div>
          <PlayButton />
        </div>
      </section>

      <footer className="border-t border-line bg-white px-4 md:px-8">
        <div className="mx-auto grid max-w-[1200px] gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:gap-8">
          <div className="flex flex-col items-start gap-4">
            <BrandMark size={40} />
            <p className="max-w-[340px] text-small text-body">
              {tr(
                "पालिकाको कृषि शाखाका लागि जग्गा, बाली र अनुदानको जानकारी, र किसानका लागि पात्रो र मौसम सूचना।",
                "Land, crop and subsidy intelligence for municipal agriculture offices, and calendars and weather alerts for farmers.",
              )}
            </p>
          </div>
          {[
            {
              title: tr("सेवा", "Product"),
              links: [
                ["#features", tr("कृषि नक्सा", "KrishiMap")],
                ["#features", tr("कृषि पात्रो", "KrishiCalendar")],
                ["#features", tr("अनुदान योजना", "Subsidy planning")],
              ],
            },
            {
              title: tr("कसका लागि", "For"),
              links: [
                ["#signin", tr("कृषि शाखा लगइन", "Agriculture office sign in")],
                ["#farmer-app", tr("किसानको एप", "Farmer app")],
              ],
            },
            {
              title: tr("जान्नुहोस्", "Learn"),
              links: [
                ["#features", tr("के गर्छ", "What it does")],
                ["#how", tr("कसरी काम गर्छ", "How it works")],
                ["/national", tr("राष्ट्रिय तथ्याङ्क", "National data")],
              ],
            },
          ].map((col) => (
            <nav key={col.title} aria-label={col.title} className="flex flex-col gap-3">
              <p className="text-small font-bold tracking-wide text-ink uppercase">{col.title}</p>
              {col.links.map(([href, label]) => (
                <a key={label} href={href} className="text-small text-body hover:text-ink">
                  {label}
                </a>
              ))}
            </nav>
          ))}
        </div>
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 border-t border-line py-6">
          <p className="text-small text-muted">
            © {new Date().getFullYear()} {tr("कृषि दृष्टि", "Krishi Dristi")}. {tr("नेपालका किसानका लागि बनाइएको।", "Made for Nepal's farmers.")}
          </p>
          <LangToggle />
        </div>
      </footer>
    </div>
  );
}

function PlayButton() {
  const { tr } = useLang();
  const url = process.env.NEXT_PUBLIC_PLAY_STORE_URL;
  const inner = (
    <>
      <svg viewBox="0 0 24 24" className="size-8 shrink-0" aria-hidden>
        <path fill="#34A853" d="M3.6 1.8 13.4 12 3.6 22.2c-.4-.2-.6-.6-.6-1.1V2.9c0-.5.2-.9.6-1.1Z" />
        <path fill="#FBBC04" d="m16.7 15.3-3.3-3.3 3.3-3.3 3.8 2.2c1.1.6 1.1 1.6 0 2.2l-3.8 2.2Z" />
        <path fill="#4285F4" d="M16.7 15.3 13.4 12 3.6 22.2c.4.2.9.2 1.4-.1l11.7-6.8Z" />
        <path fill="#EA4335" d="M16.7 8.7 5 1.9c-.5-.3-1-.3-1.4-.1L13.4 12l3.3-3.3Z" />
      </svg>
      <span className="flex flex-col leading-tight">
        <span className="text-caption text-white/75">{url ? tr("डाउनलोड गर्नुहोस्", "Get it on") : tr("चाँडै आउँदैछ", "Coming soon on")}</span>
        <span className="font-heading text-h3 text-white">Google Play</span>
      </span>
    </>
  );
  const cls = "inline-flex min-h-14 shrink-0 items-center gap-3 rounded-control bg-ink px-5 py-2";
  return url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" className={`${cls} hover:bg-black`}>
      {inner}
    </a>
  ) : (
    <span className={cls} aria-label={tr("Google Play मा चाँडै आउँदैछ", "Coming soon on Google Play")}>
      {inner}
    </span>
  );
}
