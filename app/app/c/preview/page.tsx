import { notFound } from "next/navigation";
import { CommunityPreview } from "./community-preview";

// Dev-only visual harness with mock posts. Never available in production. ("preview" is a
// reserved community name, so this static route can't shadow a real /app/c/preview community.)
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <CommunityPreview />;
}
