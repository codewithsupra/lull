import "server-only";
import { createAdminClient } from "@insforge/sdk";

/**
 * Full-access client for the few server-side steps that must bypass RLS: functions that `anon`
 * and `authenticated` deliberately cannot execute (claim_due_reminders, open_report_share,
 * join_buddy, settle_buddy_rewards). Never import this from a client component.
 */
export function createAdminInsForge() {
  return createAdminClient({ baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!, apiKey: process.env.INSFORGE_API_KEY! });
}
