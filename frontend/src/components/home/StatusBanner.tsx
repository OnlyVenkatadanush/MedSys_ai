import { motion } from "framer-motion";
import type { SystemStatus } from "@/types";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface StatusBannerProps {
  status: any;
  note: string;
}

const STATUS_STYLES: Record<
  string,
  { label: string; border: string; textClass: string; pulse: boolean }
> = {
  stable: { label: "Stable", border: "#2F6E68", textClass: "text-[#8FD4C9]", pulse: false },
  moderate: { label: "Moderate", border: "#C98A2C", textClass: "text-[#E8B968]", pulse: false },
  serious: { label: "Serious", border: "#B5502E", textClass: "text-[#E39274]", pulse: true },
};

export function StatusBanner({ status, note }: StatusBannerProps) {
  const reduced = useReducedMotion();
  const style = STATUS_STYLES[typeof status === "string" ? status : "stable"] || STATUS_STYLES.stable;
  const animate = style.pulse && !reduced;

  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl bg-ink px-6 py-7 sm:px-8 sm:py-9"
      style={{ borderLeft: `3px solid ${style.border}` }}
      animate={animate ? { opacity: [1, 0.86, 1] } : { opacity: 1 }}
      transition={animate ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" } : undefined}
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-bg-mist/50">
        System status
      </p>
      <h2
        className={[
          "mt-2 font-display text-[44px] leading-none tracking-tight sm:text-[56px]",
          style.textClass,
        ].join(" ")}
      >
        {style.label}
      </h2>
      <p className="mt-3 max-w-lg text-[15px] text-bg-mist/75">{note}</p>
    </motion.div>
  );
}
