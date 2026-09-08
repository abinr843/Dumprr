"use client";

import { useEffect } from "react";

/**
 * SmoothScrollProvider
 * Initialises Lenis smooth-scroll and wires it to GSAP's ScrollTrigger RAF.
 * Drops silently on SSR and on devices that prefer-reduced-motion.
 */
export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Respect reduced-motion preference
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    let lenis: import("lenis").default | null = null;

    async function init() {
      const [{ default: Lenis }, { gsap }, { ScrollTrigger }] = await Promise.all([
        import("lenis"),
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);

      gsap.registerPlugin(ScrollTrigger);

      lenis = new Lenis({
        duration: 1.2,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: "vertical",
        gestureOrientation: "vertical",
        smoothWheel: true,
        wheelMultiplier: 1,
        touchMultiplier: 2,
        infinite: false,
      });

      // Sync Lenis RAF with GSAP ticker
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add((time: number) => {
        lenis?.raf(time * 1000);
      });
      gsap.ticker.lagSmoothing(0);
    }

    init().catch(() => {
      // Fallback gracefully if dynamic imports fail
    });

    return () => {
      lenis?.destroy();
    };
  }, []);

  return <>{children}</>;
}
