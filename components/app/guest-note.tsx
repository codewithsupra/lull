import Link from "next/link";

export function GuestNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4 text-sm">
      <span className="text-muted">{children}</span>
      <Link href="/login?mode=signup" className="rounded-full bg-mint px-4 py-1.5 text-xs font-semibold text-bg">
        Create free account
      </Link>
    </div>
  );
}
