import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/care-plan-server";
import { EraseInput } from "@/lib/privacy";
import { deleteAccount, eraseCommunity } from "@/lib/privacy-server";
import { getMessages } from "@/lib/i18n/server";
import { logError } from "@/lib/log";

/** Erase community content, or the whole account. Both require typing the confirm word. */
export async function POST(request: NextRequest) {
  const { t } = await getMessages();
  const e = t.privacy.errors;
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const parsed = EraseInput.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: e.confirm }, { status: 400 });

  if (parsed.data.scope === "community") {
    try {
      return NextResponse.json({ ok: true, ...(await eraseCommunity(auth.userId)) });
    } catch (err) {
      logError("privacy.community.erase_failed", err);
      return NextResponse.json({ error: e.erase }, { status: 500 });
    }
  }

  const res = await deleteAccount(auth.insforge, auth.userId);
  if (!res.ok) return NextResponse.json({ error: res.reason === "subscription" ? e.subscription : e.erase }, { status: res.reason === "subscription" ? 409 : 500 });
  return NextResponse.json({ ok: true });
}
