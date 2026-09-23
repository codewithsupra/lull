import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "./auth-form";
import { getSessionUser } from "@/lib/insforge/server";
import { getMessages } from "@/lib/i18n/server";
import { splitAround } from "@/lib/i18n";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getSessionUser()) redirect("/app");
  const { t } = await getMessages();
  const params = await searchParams;
  const mode = params.mode === "signup" ? "signup" : "signin";
  const errors = t.app.auth.errors;
  const key = typeof params.error === "string" ? params.error : null;
  const error = key && key in errors ? errors[key as keyof typeof errors] : null;
  const [footerBefore, footerAfter] = splitAround(t.app.auth.footer);

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-16">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/3 h-[60vmax] w-[60vmax] -translate-x-1/2 -translate-y-1/2 animate-[spin_60s_linear_infinite] rounded-full bg-[conic-gradient(from_0deg,rgba(142,245,212,0.18),rgba(106,166,255,0.15),rgba(183,157,255,0.18),rgba(142,245,212,0.18))] blur-[90px]" />
      </div>
      <div className="w-full max-w-sm">
        <Link href="/" className="wordmark block text-center text-7xl">lull</Link>
        <div className="glass mt-8 rounded-3xl p-6 sm:p-8">
          <AuthForm initialMode={mode} urlError={error} />
        </div>
        <p className="mono-label mt-6 text-center !text-[10px]">
          {footerBefore}
          <Link href="/app/breathe" className="underline decoration-white/20 hover:text-ink">
            {t.app.auth.continueAsGuest}
          </Link>
          {footerAfter}
        </p>
      </div>
    </main>
  );
}
