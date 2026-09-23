import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@insforge/sdk/ssr/middleware";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, detectLocale, isLocale } from "@/lib/i18n";

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });
  await updateSession({
    requestCookies: request.cookies,
    responseCookies: response.cookies,
  });

  // Language resolution (FR8), in priority order:
  //   1. ?lang=hi — shareable links for campaigns, and an escape hatch if detection is wrong
  //   2. an existing cookie — the user's own choice always wins over their browser's guess
  //   3. Accept-Language — a Hindi-speaking visitor should land in Hindi, not have to hunt for it
  // Whatever wins is written back, so the first render and every render after it agree.
  const requested = request.nextUrl.searchParams.get("lang");
  const saved = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(requested) ? requested : isLocale(saved) ? saved : detectLocale(request.headers.get("accept-language"));

  if (locale !== saved) {
    response.cookies.set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: LOCALE_COOKIE_MAX_AGE,
      sameSite: "lax",
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
    });
    // So Server Components in this same request see the winning locale, not the stale cookie.
    request.cookies.set(LOCALE_COOKIE, locale);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|opengraph-image|.*\\.(?:png|jpg|svg|webp|ico)$).*)"],
};
