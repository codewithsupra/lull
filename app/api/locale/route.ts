import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { LOCALES, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from "@/lib/i18n";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { logError } from "@/lib/log";

const Body = z.object({ locale: z.enum(LOCALES) });

/**
 * Records a language choice.
 *
 * The cookie is what renders the app, and it is set here as well as on the client so the choice
 * survives a browser that blocks document.cookie writes. Signed-in users also get it stored on
 * their care profile, so notifications and AI replies arrive in the same language as the UI.
 * Deliberately open to signed-out visitors: picking a language should not require an account.
 */
export async function POST(request: NextRequest) {
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Unsupported language." }, { status: 400 });
  const { locale } = parsed.data;

  const response = NextResponse.json({ ok: true, locale });
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
    // Readable by the client so the provider can hydrate without a round trip.
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  });

  try {
    const insforge = await createInsForgeServerClient();
    const { data } = await insforge.auth.getCurrentUser();
    if (data?.user) {
      const { error } = await insforge.database.from("care_profiles").update({ locale }).eq("user_id", data.user.id);
      // A missing profile row simply means they have not started a Care Plan yet; the cookie
      // still carries their choice, so this is not worth failing the request over.
      if (error) logError("locale.persist.failed", error, { user: data.user.id, locale });
    }
  } catch (err) {
    logError("locale.persist.failed", err, { locale });
  }

  return response;
}
