import { notFound } from "next/navigation";
import { InvitePreview } from "./invite-preview";

// Dev-only visual harness with mock data (share cards + buddy panel). Never available in production.
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <InvitePreview />;
}
