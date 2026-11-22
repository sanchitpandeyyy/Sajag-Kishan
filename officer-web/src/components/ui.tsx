/**
 * Shared layout and button primitives (CEE Mentor layout system, Sajag Kishan colours).
 * Buttons: 48px default, 56px (lg) for the one main action on a screen.
 */
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "brand" | "secondary" | "ghost" | "inverse";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-control border-[1.5px] font-sans text-base leading-6 font-bold whitespace-nowrap no-underline cursor-pointer transition-[background-color,border-color,transform] duration-150 ease-out active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "border-transparent bg-accent text-ink hover:bg-accent-strong", // sun gold: main CTA
  brand: "border-transparent bg-brand-800 text-white hover:bg-brand-900",
  secondary: "border-input-border bg-white text-ink hover:border-ink",
  ghost: "border-transparent bg-transparent text-ink hover:bg-fill",
  inverse: "border-transparent bg-white text-brand-800 hover:bg-fill",
};

const sizes: Record<Size, string> = {
  md: "min-h-12 px-5",
  lg: "min-h-14 px-7 text-[17px]",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = "") {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`;
}

type Common = { variant?: Variant; size?: Size; className?: string; children: ReactNode };

export function ButtonLink({ variant, size, className, children, ...props }: Common & Omit<ComponentProps<typeof Link>, "className" | "children">) {
  return (
    <Link className={buttonClass(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}

export function ButtonA({ variant, size, className, children, ...props }: Common & Omit<ComponentProps<"a">, "className" | "children">) {
  return (
    <a className={buttonClass(variant, size, className)} {...props}>
      {children}
    </a>
  );
}

/** Page section with standard gutters, 1200px content width and 88px desktop rhythm. */
export function Section({
  children,
  className = "",
  inner = "",
  id,
  label,
}: {
  children: ReactNode;
  className?: string;
  inner?: string;
  id?: string;
  label?: string;
}) {
  return (
    <section id={id} aria-label={label} className={`px-4 py-14 md:px-8 md:py-[88px] ${className}`}>
      <div className={`mx-auto flex max-w-[1200px] flex-col ${inner}`}>{children}</div>
    </section>
  );
}

/** Centered section heading: plain eyebrow text, title, optional lead. No badges. */
export function SectionHead({ eyebrow, title, text, onDark = false, align = "center" }: { eyebrow: string; title: string; text?: string; onDark?: boolean; align?: "center" | "left" }) {
  const a = align === "center" ? "items-center text-center" : "items-start text-left";
  return (
    <div className={`flex flex-col gap-3 ${a}`}>
      <p className={`text-small font-bold tracking-wide uppercase ${onDark ? "text-brand-300" : "text-brand-700"}`}>{eyebrow}</p>
      <h2 className={`font-heading text-h1 md:text-display ${onDark ? "text-white" : "text-ink"}`}>{title}</h2>
      {text ? <p className={`max-w-[620px] text-lead ${onDark ? "text-white/80" : "text-body"}`}>{text}</p> : null}
    </div>
  );
}
