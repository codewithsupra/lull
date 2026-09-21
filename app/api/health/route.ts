import { NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";

export const dynamic = "force-dynamic";

/** Pinged daily by Vercel Cron so the free-tier backend never idles into a pause. */
export async function GET() {
  const insforge = createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
  });
  const started = Date.now();
  const { error } = await insforge.auth.getPublicAuthConfig();
  return NextResponse.json({ ok: !error, backendMs: Date.now() - started }, { status: error ? 503 : 200 });
}
