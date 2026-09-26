import type { Metadata } from "next";
import { ReportView } from "@/components/report/report-view";
import { PrintButton } from "@/components/report/print-button";
import { openShare } from "@/lib/report-server";
import { getMessages } from "@/lib/i18n/server";
import { messagesFor } from "@/lib/i18n";

export const dynamic = "force-dynamic";

// Deliberately generic, and never derived from the report: link unfurlers (WhatsApp, email
// previews) fetch this metadata, and opening the share here would also count as a view.
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getMessages();
  return {
    title: t.report.sharedMetaTitle,
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
    referrer: "no-referrer",
    openGraph: null,
  };
}

/** The doctor's view of a patient-held report (FR10). No account, no app chrome, no tracking. */
export default async function SharedReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const shared = await openShare(token);

  if (!shared) {
    const { t } = await getMessages();
    return (
      <main className="flex min-h-dvh items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p className="wordmark text-3xl">lull</p>
          <h1 className="mt-8 text-2xl font-semibold text-ink">{t.report.goneTitle}</h1>
          <p className="mt-3 text-muted">{t.report.goneBody}</p>
        </div>
      </main>
    );
  }

  // The report renders in the language the patient chose for their doctor, not the viewer's cookie.
  const t = messagesFor(shared.locale);
  return (
    <main className="min-h-dvh px-3 py-6 sm:px-6 sm:py-10">
      <div data-print-hide className="mx-auto mb-5 flex max-w-[820px] flex-wrap items-center justify-between gap-3 px-1">
        <p className="text-sm text-muted">🔒 {t.report.privacyNote}</p>
        <PrintButton label={t.report.printButton} className="rounded-full border border-white/15 px-4 py-2 text-sm text-ink hover:bg-white/10" />
      </div>
      <ReportView report={shared.report} t={t} locale={shared.locale} />
    </main>
  );
}
