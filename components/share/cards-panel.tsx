"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/locale-provider";
import { drawCard, loadCardFonts } from "@/components/share/draw-card";
import { availableCards, type CardKind, type CardStats } from "@/lib/share-card";
import { SITE } from "@/lib/site";

/** Share cards (FR10): drawn on-device, shared via the OS share sheet or downloaded. */
export function CardsPanel({ stats, inviteUrl }: { stats: CardStats; inviteUrl: string }) {
  const { t } = useI18n();
  const c = t.invite.cards;
  const kinds = useMemo(() => availableCards(stats), [stats]);
  const [kind, setKind] = useState<CardKind | null>(kinds[0] ?? null);
  const [withLink, setWithLink] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const footer = withLink ? inviteUrl.replace(/^https?:\/\//, "") : SITE.url.replace(/^https?:\/\//, "");

  useEffect(() => {
    if (!kind) return;
    let cancelled = false;
    loadCardFonts().then((fonts) => {
      if (cancelled) return;
      const canvas = canvasRef.current ?? document.createElement("canvas");
      canvasRef.current = canvas;
      drawCard(canvas, kind, stats, t, fonts, footer);
      setPreview(canvas.toDataURL("image/png"));
    });
    return () => {
      cancelled = true;
    };
  }, [kind, stats, t, footer]);

  const blob = () => new Promise<Blob | null>((resolve) => (canvasRef.current ? canvasRef.current.toBlob(resolve, "image/png") : resolve(null)));

  const share = async () => {
    const b = await blob();
    if (!b) return;
    const file = new File([b], `lull-${kind}.png`, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: c.shareTitle, ...(withLink ? { text: inviteUrl } : {}) }).catch(() => undefined);
    } else {
      download(b);
    }
  };

  const download = async (given?: Blob) => {
    const b = given ?? (await blob());
    if (!b) return;
    const url = URL.createObjectURL(b);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lull-${kind}.png`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="glass rounded-3xl p-6">
      <h2 className="text-lg font-semibold">{c.heading}</h2>
      <p className="mt-1 text-sm text-muted">{c.hint}</p>
      {!kind ? (
        <p className="mt-6 text-sm text-muted">{c.none}</p>
      ) : (
        <>
          <div className="mt-4 flex gap-2">
            {kinds.map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`rounded-full border px-3 py-1.5 text-sm ${k === kind ? "border-mint/60 bg-mint/15 text-ink" : "border-line text-muted hover:text-ink"}`}
              >
                {c.kinds[k]}
              </button>
            ))}
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-black/40" style={{ aspectRatio: "1080 / 1350" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- a local data: URL, not an optimisable asset */}
            {preview && <img src={preview} alt={`${c.kinds[kind]} card`} className="h-full w-full object-cover" />}
          </div>
          <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={withLink} onChange={(e) => setWithLink(e.target.checked)} className="h-4 w-4 accent-[var(--mint)]" />
            {c.includeLink}
          </label>
          <div className="mt-4 flex gap-2">
            <button onClick={share} className="flex-1 rounded-full bg-mint py-2.5 text-sm font-semibold text-bg">
              {c.share}
            </button>
            <button onClick={() => download()} className="flex-1 rounded-full border border-line py-2.5 text-sm">
              {c.download}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
