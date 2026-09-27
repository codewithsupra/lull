"use client";

import { CARD_H, CARD_W, cardSeed, cardText, gardenPlants, seededRandom, type CardKind, type CardStats } from "@/lib/share-card";
import type { Messages } from "@/lib/i18n";

/**
 * Paints a share card (FR10) onto a canvas, entirely on the user's device. Uses the page's own
 * next/font faces (read from the CSS variables next/font sets on <html>) so Devanagari is shaped
 * by the browser — server-side image generators can't shape Hindi conjuncts correctly.
 */

function fontStack(...vars: string[]) {
  const root = getComputedStyle(document.documentElement);
  return vars.map((v) => root.getPropertyValue(v).trim()).filter(Boolean).join(", ") || "sans-serif";
}

/** Waits for the faces the card needs, including the Devanagari subsets (loaded lazily by next/font). */
export async function loadCardFonts() {
  const display = fontStack("--font-unbounded", "--font-deva-display");
  const sans = fontStack("--font-geist-sans", "--font-deva");
  const mono = fontStack("--font-geist-mono");
  const sample = "Lull 0123456789 लगातार बग़ीचा";
  await Promise.all([
    document.fonts.load(`600 120px ${display}`, sample),
    document.fonts.load(`500 48px ${sans}`, sample),
    document.fonts.load(`400 32px ${mono}`, "lull-ai.vercel.app"),
  ]).catch(() => undefined);
  return { display, sans, mono };
}

function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: number, start: number, family: string, maxWidth: number) {
  let size = start;
  ctx.font = `${weight} ${size}px ${family}`;
  while (size > 40 && ctx.measureText(text).width > maxWidth) {
    size -= 6;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

export function drawCard(
  canvas: HTMLCanvasElement,
  kind: CardKind,
  stats: CardStats,
  t: Messages,
  fonts: { display: string; sans: string; mono: string },
  footer: string,
) {
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = CARD_W, H = CARD_H;
  const rand = seededRandom(cardSeed(stats, kind));

  // Night sky.
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#060a1a");
  sky.addColorStop(0.55, "#0c1531");
  sky.addColorStop(1, "#03050b");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.82, H * 0.12, 0, W * 0.82, H * 0.12, W * 0.7);
  glow.addColorStop(0, "rgba(142,245,212,0.20)");
  glow.addColorStop(1, "rgba(142,245,212,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 110; i++) {
    ctx.globalAlpha = 0.25 + rand() * 0.6;
    ctx.fillStyle = "#dfe8ff";
    ctx.beginPath();
    ctx.arc(rand() * W, rand() * H * 0.62, rand() * 2 + 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Ground and garden.
  const ground = H * 0.8;
  ctx.fillStyle = "#050814";
  ctx.beginPath();
  ctx.moveTo(0, ground + 20);
  ctx.bezierCurveTo(W * 0.3, ground - 30, W * 0.7, ground + 40, W, ground - 10);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();

  for (const p of gardenPlants(stats, cardSeed(stats, kind))) {
    const x = p.x * W;
    const top = ground - p.height * H;
    ctx.strokeStyle = `hsla(${p.hue}, 55%, 62%, 0.85)`;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, ground + 6);
    ctx.quadraticCurveTo(x + p.sway * W, (ground + top) / 2, x + p.sway * W * 0.6, top);
    ctx.stroke();
    if (p.bloom) {
      const bx = x + p.sway * W * 0.6;
      const halo = ctx.createRadialGradient(bx, top, 0, bx, top, 38);
      halo.addColorStop(0, `hsla(${p.hue}, 90%, 80%, 0.95)`);
      halo.addColorStop(1, `hsla(${p.hue}, 90%, 70%, 0)`);
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(bx, top, 38, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f4fff9";
      ctx.beginPath();
      ctx.arc(bx, top, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Fireflies for the streak, as in the in-app garden.
  for (let i = 0; i < Math.min(stats.streak, 24); i++) {
    const fx = W * (0.1 + rand() * 0.8), fy = ground - H * (0.05 + rand() * 0.3);
    const f = ctx.createRadialGradient(fx, fy, 0, fx, fy, 16);
    f.addColorStop(0, "rgba(233,255,120,0.95)");
    f.addColorStop(1, "rgba(233,255,120,0)");
    ctx.fillStyle = f;
    ctx.beginPath();
    ctx.arc(fx, fy, 16, 0, Math.PI * 2);
    ctx.fill();
  }

  // Wordmark.
  const mark = ctx.createLinearGradient(80, 80, 80, 170);
  mark.addColorStop(0, "#d9fff3");
  mark.addColorStop(1, "#8ed7f5");
  ctx.fillStyle = mark;
  ctx.font = `600 72px ${fonts.display}`;
  ctx.textBaseline = "top";
  ctx.fillText("lull", 80, 84);

  // The one number (or level name) the card is about.
  const text = cardText(kind, stats, t);
  ctx.fillStyle = "#f2f5ff";
  ctx.textBaseline = "alphabetic";
  const bigSize = fitFont(ctx, text.big, 600, kind === "level" ? 150 : 300, fonts.display, W - 160);
  ctx.fillText(text.big, 80, 260 + bigSize * 0.8);
  const y = 260 + bigSize * 0.8 + 90;
  ctx.font = `500 ${fitFont(ctx, text.label, 500, 64, fonts.sans, W - 160)}px ${fonts.sans}`;
  ctx.fillText(text.label, 80, y);
  ctx.fillStyle = "rgba(226,232,255,0.62)";
  ctx.font = `400 ${fitFont(ctx, text.sub, 400, 44, fonts.sans, W - 160)}px ${fonts.sans}`;
  ctx.fillText(text.sub, 80, y + 66);

  // Footer.
  ctx.fillStyle = "rgba(226,232,255,0.7)";
  ctx.font = `400 ${fitFont(ctx, footer, 400, 34, fonts.mono, W - 160)}px ${fonts.mono}`;
  ctx.fillText(footer, 80, H - 70);
}
