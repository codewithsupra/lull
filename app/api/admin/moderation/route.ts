import { NextResponse, type NextRequest } from "next/server";
import { ModAction } from "@/lib/moderation";
import { act, loadDashboard, requireAdmin } from "@/lib/moderation-server";
import { logError } from "@/lib/log";

/** Moderation dashboard data. Admins only; everyone else gets a 404. */
export async function GET() {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  try {
    return NextResponse.json(await loadDashboard());
  } catch (err) {
    logError("community.mod.load_failed", err);
    return NextResponse.json({ error: "Couldn't load the moderation queue." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  const parsed = ModAction.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  try {
    const res = await act(parsed.data);
    return res.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: res.error }, { status: res.status });
  } catch (err) {
    logError("community.mod.action_failed", err, { action: parsed.data.action });
    return NextResponse.json({ error: "That action failed." }, { status: 500 });
  }
}
