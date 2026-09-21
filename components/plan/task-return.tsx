"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { completeTask } from "@/lib/care-client";

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
  return (
    <div className={`rounded-2xl border p-4 text-sm ${state === "done" ? "border-lime/40 bg-lime/[0.07]" : "border-lilac/25 bg-lilac/[0.05]"}`}>
      {state === "done" ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-lime">✓ Plan task complete · +{xp} XP</span>
          <Link href="/app/plan" className="rounded-full bg-lime px-3 py-1 text-xs font-semibold text-bg">
            Back to plan
          </Link>
        </div>
      ) : state === "error" ? (
        <span className="text-rose">Couldn&apos;t save your progress. You can tick it off in your plan.</span>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted">{hint ?? "Finish this session to complete your plan task."}</span>
          <Link href="/app/plan" className="shrink-0 font-mono text-xs text-muted hover:text-ink">
            ← plan
          </Link>
        </div>
      )}
    </div>
  );
}
