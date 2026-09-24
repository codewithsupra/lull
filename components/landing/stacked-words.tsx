"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

import { useI18n } from "@/components/i18n/locale-provider";

const STYLES = [
  { style: "outline-text", dir: -1 },
  { style: "solid-lime", dir: 1 },
  { style: "outline-text", dir: -1 },
  { style: "solid-lime", dir: 1 },
];

export function StackedWords() {
  const { t } = useI18n();
  const words = STYLES.map((s, i) => ({ ...s, text: t.landing.words[i] }));
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const shifts = [
    useTransform(scrollYProgress, [0, 1], ["18%", "-22%"]),
    useTransform(scrollYProgress, [0, 1], ["-24%", "14%"]),
    useTransform(scrollYProgress, [0, 1], ["14%", "-18%"]),
    useTransform(scrollYProgress, [0, 1], ["-16%", "20%"]),
  ];
  const skew = useTransform(scrollYProgress, [0, 0.5, 1], [-8, 0, 8]);

  return (
    <div ref={ref} className="relative overflow-hidden py-24 sm:py-40" aria-label={t.landing.words.join(", ")}>
      {words.map((w, i) => (
        <motion.div
          key={w.text}
          style={{ x: shifts[i], skewX: skew }}
          className={`${w.style} whitespace-nowrap text-center text-[17vw] leading-[0.9] sm:text-[13vw]`}
        >
          {w.text}
        </motion.div>
      ))}
    </div>
  );
}
