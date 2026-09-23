"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Feature } from "@/lib/billing";
import { onPaywall } from "@/lib/billing-client";
import { Pricing } from "./pricing";
import { useI18n } from "@/components/i18n/locale-provider";

/** Mounted once in the app shell; any 402 from the API opens this sheet. */
export function PaywallHost() {
  const { t } = useI18n();
  const [open, setOpen] = useState<{ feature?: Feature } | null>(null);

  useEffect(() => onPaywall((feature) => setOpen({ feature })), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] grid items-end bg-bg/70 backdrop-blur-md sm:place-items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setOpen(null)}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t.app.billing.upgradeLabel}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="glass relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl p-6 sm:max-w-md sm:rounded-3xl sm:p-8"
          >
            <button onClick={() => setOpen(null)} className="absolute right-5 top-5 font-mono text-xs text-muted hover:text-ink" aria-label={t.app.billing.close}>
              {t.app.billing.esc}
            </button>
            <Pricing feature={open.feature} compact onPlan={(p) => p.pro && setOpen(null)} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
