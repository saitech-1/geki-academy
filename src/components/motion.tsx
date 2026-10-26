"use client";
import {
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
} from "react";

// Each section hydrates its own unchanged server markup before enabling motion.
// A provider must not mutate descendants that may still be hydrating/streaming.
export function RevealSection({
  children,
  ...props
}: ComponentPropsWithoutRef<"section">) {
  const element = useRef<HTMLElement>(null);
  const [stage, setStage] = useState<"pending" | "visible">();
  useEffect(() => {
    const section = element.current;
    if (!section) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let observer: IntersectionObserver | undefined;
    let revealed = false;
    const setup = () => {
      observer?.disconnect();
      if (preference.matches || !("IntersectionObserver" in window)) {
        setStage(undefined);
        return;
      }
      // Already visible content never flashes away during hydration.
      const rect = section.getBoundingClientRect();
      if (revealed || rect.top < window.innerHeight) {
        revealed = true;
        setStage("visible");
        return;
      }
      setStage("pending");
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            revealed = true;
            setStage("visible");
            observer?.disconnect();
          }
        },
        { threshold: 0.08, rootMargin: "0px 0px -25px 0px" },
      );
      observer.observe(section);
    };
    setup();
    preference.addEventListener("change", setup);
    return () => {
      observer?.disconnect();
      preference.removeEventListener("change", setup);
    };
  }, []);
  return (
    <section {...props} ref={element} data-scroll-reveal={stage}>
      {children}
    </section>
  );
}
