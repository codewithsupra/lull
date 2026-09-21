import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lull — Calm, composed for you",
    short_name: "Lull",
    description: "Your prescription, turned into a daily plan you'll actually follow.",
    start_url: "/app/plan",
    display: "standalone",
    background_color: "#03050b",
    theme_color: "#03050b",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
