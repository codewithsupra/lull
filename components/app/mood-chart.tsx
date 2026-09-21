import { MOODS, type MoodCheckin } from "@/lib/data";

/** Smooth area chart of mood over the most recent check-ins (oldest → newest). */
export function MoodChart({ checkins, height = 140 }: { checkins: MoodCheckin[]; height?: number }) {
  const pts = [...checkins].reverse();
  const W = 600;
  const H = height;
  const pad = 14;
  if (pts.length < 2) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-white/10 text-sm text-muted" style={{ height }}>
        Your mood curve appears after two check-ins.
      </div>
    );
  }
  const x = (i: number) => pad + (i / (pts.length - 1)) * (W - pad * 2);
  const y = (v: number) => H - pad - ((v - 1) / 4) * (H - pad * 2);
  let d = `M ${x(0)} ${y(pts[0].mood)}`;
  for (let i = 1; i < pts.length; i++) {
    const cx = (x(i - 1) + x(i)) / 2;
    d += ` C ${cx} ${y(pts[i - 1].mood)}, ${cx} ${y(pts[i].mood)}, ${x(i)} ${y(pts[i].mood)}`;
  }
  const area = `${d} L ${x(pts.length - 1)} ${H} L ${x(0)} ${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} role="img" aria-label="Mood over recent check-ins">
      <defs>
        <linearGradient id="moodFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8ef5d4" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#6aa6ff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="moodLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#6aa6ff" />
          <stop offset="100%" stopColor="#8ef5d4" />
        </linearGradient>
      </defs>
      {[1, 3, 5].map((v) => (
        <line key={v} x1={pad} x2={W - pad} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 5" />
      ))}
      <path d={area} fill="url(#moodFill)" />
      <path d={d} fill="none" stroke="url(#moodLine)" strokeWidth="2.5" strokeLinecap="round" />
      {pts.map((p, i) => (
        <circle key={p.id} cx={x(i)} cy={y(p.mood)} r="4" fill={MOODS[p.mood - 1].color} stroke="#03050b" strokeWidth="2">
          <title>{`${MOODS[p.mood - 1].label} · ${new Date(p.created_at).toLocaleString()}`}</title>
        </circle>
      ))}
    </svg>
  );
}
