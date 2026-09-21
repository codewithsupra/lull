"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

const WORDS = [
  { text: "breathe", style: "outline-text", dir: -1 },
  { text: "soundscape", style: "solid-lime", dir: 1 },
  { text: "compose", style: "outline-text", dir: -1 },
  { text: "sleep", style: "solid-lime", dir: 1 },
];

export function StackedWords() {
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
    <div ref={ref} className="relative overflow-hidden py-24 sm:py-40" aria-label="Breathe, soundscape, compose, sleep">
      {WORDS.map((w, i) => (
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
