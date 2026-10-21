"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
export function MotionEffects() {
  const pathname = usePathname();
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const frame = requestAnimationFrame(() => {
      document.documentElement.classList.add("motion-ready");
      const targets = document.querySelectorAll(
        "main>.section, main>.pricing-head, main>.price-grid",
      );
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries)
            if (entry.isIntersecting) {
              entry.target.classList.add("visible");
              observer.unobserve(entry.target);
            }
        },
        { threshold: 0.08, rootMargin: "0px 0px -25px 0px" },
      );
      targets.forEach((target) => {
        target.classList.add("scroll-reveal");
        observer.observe(target);
      });
      cleanup = () => {
        observer.disconnect();
        targets.forEach((target) =>
          target.classList.remove("scroll-reveal", "visible"),
        );
      };
    });
    let cleanup = () => {};
    return () => {
      cancelAnimationFrame(frame);
      cleanup();
    };
  }, [pathname]);
  return null;
}
