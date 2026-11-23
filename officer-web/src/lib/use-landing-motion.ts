"use client";

import { useEffect, type RefObject } from "react";

// gsap is only needed by the landing page, so load it after first paint instead of in the page bundle.
export function useLandingMotion(scope: RefObject<HTMLElement | null>, formatNumber: (n: number) => string, deps: unknown[] = []) {
  useEffect(() => {
    let cancelled = false;
    let revert: (() => void) | undefined;

    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([{ default: gsap }, { ScrollTrigger }]) => {
      if (cancelled || !scope.current) return;
      gsap.registerPlugin(ScrollTrigger);
      const ctx = gsap.context(() => {
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
      }, scope.current);
      revert = () => ctx.revert();
    });

    return () => {
      cancelled = true;
      revert?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
