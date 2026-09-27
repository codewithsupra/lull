import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/care-plan-server";
import { BUDDY_COOKIE, normalizeCode } from "@/lib/buddy";
import { joinBuddy, settleBuddy } from "@/lib/buddy-server";

/** Explicit join from the invite page. The code is validated before it reaches the database. */
export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => ({}))) as { code?: string };
  const code = normalizeCode(body.code);
  const result = code ? await joinBuddy(auth.userId, code) : "invalid";
  (await cookies()).delete(BUDDY_COOKIE);
  if (result === "joined") await settleBuddy(auth.userId);
  return NextResponse.json({ result }, { status: result === "joined" ? 200 : 409 });
}
