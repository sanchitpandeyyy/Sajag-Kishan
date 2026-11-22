"use client";

/**
 * Scroll effects for the landing page (GSAP + ScrollTrigger). Subtle by design:
 * short distances, quick eases, nothing loops. Disabled for prefers-reduced-motion.
 *
 * Markup hooks (data attributes inside the scope element):
 *   data-reveal              fade up once when it enters the viewport
 *   data-stagger             its direct children fade up one after another
 *   data-parallax="0.12"     drifts slower than the page while in view (fraction of its height)
 *   data-count="753"         number counts up from 0 when it enters the viewport
 *   data-scale-in            image settles from 1.06 to 1 as it scrolls into view
 */
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { RefObject } from "react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function useLandingMotion(scope: RefObject<HTMLElement | null>, formatNumber: (n: number) => string, deps: unknown[] = []) {
  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
          gsap.from(el, {
            y: 28,
            autoAlpha: 0,
            duration: 0.7,
            ease: "power2.out",
            scrollTrigger: { trigger: el, start: "top 85%", once: true },
          });
        });

        gsap.utils.toArray<HTMLElement>("[data-stagger]").forEach((group) => {
          gsap.from(group.children, {
            y: 32,
            autoAlpha: 0,
            duration: 0.65,
            ease: "power2.out",
            stagger: 0.1,
            scrollTrigger: { trigger: group, start: "top 82%", once: true },
          });
        });

        gsap.utils.toArray<HTMLElement>("[data-parallax]").forEach((el) => {
          const amount = Number(el.dataset.parallax ?? 0.1);
          gsap.fromTo(
            el,
            { yPercent: -amount * 50 },
            {
              yPercent: amount * 50,
              ease: "none",
              scrollTrigger: { trigger: el.parentElement ?? el, start: "top bottom", end: "bottom top", scrub: true },
            },
          );
        });

        gsap.utils.toArray<HTMLElement>("[data-scale-in]").forEach((el) => {
          gsap.fromTo(
            el,
            { scale: 1.06 },
            { scale: 1, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "center center", scrub: true } },
          );
        });

        gsap.utils.toArray<HTMLElement>("[data-count]").forEach((el) => {
          const target = Number(el.dataset.count ?? 0);
          const counter = { v: 0 };
          el.textContent = formatNumber(0);
          gsap.to(counter, {
            v: target,
            duration: 1.4,
            ease: "power2.out",
            scrollTrigger: { trigger: el, start: "top 90%", once: true },
            onUpdate: () => {
              el.textContent = formatNumber(Math.round(counter.v));
            },
          });
        });
      });

      return () => mm.revert();
    },
    { scope, dependencies: deps, revertOnUpdate: true },
  );
}
