"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { completeTask } from "@/lib/care-client";
import { useI18n } from "@/components/i18n/locale-provider";
import { fmt } from "@/lib/i18n";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Completes a plan task (opened via a deep link) once the practice is actually done. */
export function useTaskCompletion(taskId?: string) {
  const [state, setState] = useState<"idle" | "done" | "error">("idle");
  const [xp, setXp] = useState(0);
  const fired = useRef(false);
  const complete = useCallback(async () => {
    if (!taskId || !UUID.test(taskId) || fired.current) return;
    fired.current = true;
    try {
      const res = await completeTask(taskId, true);
      setXp(res.xp);
      setState("done");
    } catch {
      fired.current = false;
      setState("error");
    }
  }, [taskId]);
  return { state, xp, complete };
}

export function TaskReturn({ state, xp, hint }: { state: "idle" | "done" | "error"; xp: number; hint?: string }) {
  const { t } = useI18n();
  const r = t.app.taskReturn;
  return (
    <div className={`rounded-2xl border p-4 text-sm ${state === "done" ? "border-lime/40 bg-lime/[0.07]" : "border-lilac/25 bg-lilac/[0.05]"}`}>
      {state === "done" ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-lime">{fmt(r.done, { xp })}</span>
          <Link href="/app/plan" className="rounded-full bg-lime px-3 py-1 text-xs font-semibold text-bg">
            {r.backToPlan}
          </Link>
        </div>
      ) : state === "error" ? (
        <span className="text-rose">{r.failed}</span>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted">{hint ?? r.hint}</span>
          <Link href="/app/plan" className="shrink-0 font-mono text-xs text-muted hover:text-ink">
            {r.planLink}
          </Link>
        </div>
      )}
    </div>
  );
}
