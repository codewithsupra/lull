import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/care-plan-server";
import { NameInput } from "@/lib/privacy";
import { getMessages } from "@/lib/i18n/server";
import { logError } from "@/lib/log";

/** Correct your display name (DPDP right to correction). */
export async function POST(request: NextRequest) {
  const { t } = await getMessages();
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const parsed = NameInput.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: t.privacy.errors.name }, { status: 400 });
  const { error } = await auth.insforge.auth.setProfile({ name: parsed.data.name });
  if (error) {
    logError("privacy.name.failed", error, { user: auth.userId });
    return NextResponse.json({ error: t.privacy.errors.name }, { status: 500 });
  }
  return NextResponse.json({ name: parsed.data.name });
}
