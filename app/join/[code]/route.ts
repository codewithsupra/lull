import { NextResponse, type NextRequest } from "next/server";
import { BUDDY_COOKIE, BUDDY_COOKIE_MAX_AGE, normalizeCode } from "@/lib/buddy";

/**
 * /join/ABCDEFGH — an invite link. The code rides in a short-lived httpOnly cookie through
 * sign-up, then the invite page shows it and asks the person to confirm joining. A malformed code
 * is dropped here and never stored.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = normalizeCode((await params).code);
  const target = new URL(code ? `/app/invite?join=${code}` : "/app/invite", request.nextUrl.origin);
  const res = NextResponse.redirect(target);
  if (code) {
    res.cookies.set(BUDDY_COOKIE, code, {
      path: "/",
      maxAge: BUDDY_COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
  return res;
}
