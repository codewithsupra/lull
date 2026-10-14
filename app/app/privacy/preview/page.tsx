import { notFound } from "next/navigation";
import { PrivacyView } from "@/components/privacy/privacy-view";
import type { PrivacySummary } from "@/lib/privacy";

// Dev-only visual harness with mock data. Never available in production.
const MOCK: PrivacySummary = {
  account: { email: "riya@example.com", name: "Riya", created_at: "2026-09-24T10:00:00Z" },
  consent: { version: "2026-09-v1", at: "2026-09-24T10:05:00Z" },
  counts: { account: 1, plan: 64, screeners: 3, safety: 1, companion: 42, journal: 12, practice: 9, reports: 2, buddy: 2, community: 5, billing: 1, devices: 1, usage: 18 },
  deletion_blocked: false,
  grievance: null,
};

export default async function Page({ searchParams }: { searchParams: Promise<{ blocked?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { blocked } = await searchParams;
  return <PrivacyView mock={{ ...MOCK, deletion_blocked: blocked === "1" }} />;
}
