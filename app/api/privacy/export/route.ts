import { NextResponse } from "next/server";
import { requireUser } from "@/lib/care-plan-server";
import { buildExport } from "@/lib/privacy-server";
import { exportFilename } from "@/lib/privacy";
import { getMessages } from "@/lib/i18n/server";
import { logError, logEvent } from "@/lib/log";

/** Download everything, decrypted, as one JSON file (DPDP right of access / portability). */
export async function GET() {
  const { t } = await getMessages();
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    const data = await buildExport(auth.insforge, auth.userId);
    logEvent("privacy.exported", { user: auth.userId });
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exportFilename(new Date())}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err) {
    logError("privacy.export.failed", err, { user: auth.userId });
    return NextResponse.json({ error: t.privacy.errors.export }, { status: 500 });
  }
}
