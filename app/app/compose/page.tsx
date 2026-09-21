import { ComposeClient } from "./compose-client";

export default async function ComposePage({ searchParams }: PageProps<"/app/compose">) {
  const { q, task } = await searchParams;
  return <ComposeClient initialPrompt={typeof q === "string" ? q.slice(0, 600) : ""} taskId={typeof task === "string" ? task : undefined} />;
}
