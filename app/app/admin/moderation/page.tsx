import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isCurrentUserAdmin } from "@/lib/moderation-server";
import { ModerationClient } from "./moderation-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Moderation · Lull", robots: { index: false, follow: false } };

/**
 * Community moderation (owner-only). The admin check runs on the server before any HTML exists;
 * everyone else gets the ordinary 404 page. Internal tooling for a single operator, so it's
 * English-only — a deliberate exception to FR8's member-facing Hindi coverage.
 */
export default async function ModerationPage() {
  if (!(await isCurrentUserAdmin())) notFound();
  return <ModerationClient />;
}
