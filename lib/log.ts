import "server-only";

/**
 * Health-safe logging: only an event name, a code and non-sensitive ids ever reach logs.
 * Never pass request bodies, model output, medication names or user text here.
 */
export function logEvent(event: string, meta: Record<string, string | number | boolean | null | undefined> = {}) {
  console.info(JSON.stringify({ event, ...meta, at: new Date().toISOString() }));
}

export function logError(event: string, err: unknown, meta: Record<string, string | number | boolean | null | undefined> = {}) {
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code: unknown }).code)
      : err instanceof Error
        ? err.name
        : "unknown";
  const status = err && typeof err === "object" && "status" in err ? Number((err as { status: unknown }).status) : undefined;
  console.error(JSON.stringify({ event, code, status, ...meta, at: new Date().toISOString() }));
}
