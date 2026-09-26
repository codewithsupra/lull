"use client";

/** Opens the browser's print dialog, where "Save as PDF" lives on every desktop and mobile OS. */
export function PrintButton({ label, className }: { label: string; className?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={className} data-print-hide>
      {label}
    </button>
  );
}
