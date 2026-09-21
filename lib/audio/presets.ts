import type { Mix } from "./engine";

export const SOUND_PRESETS: { slug: string; name: string; mix: Mix }[] = [
  { slug: "night-rain", name: "Night rain", mix: { rain: 0.8, brown: 0.35, drone: 0.4 } },
  { slug: "low-tide", name: "Low tide", mix: { ocean: 0.85, wind: 0.25, bowls: 0.4 } },
  { slug: "cabin-fire", name: "Cabin fire", mix: { fire: 0.8, wind: 0.45, drone: 0.25 } },
  { slug: "deep-focus", name: "Deep focus", mix: { brown: 0.85, rain: 0.2 } },
  { slug: "temple", name: "Temple", mix: { bowls: 0.7, drone: 0.6, wind: 0.2 } },
];
