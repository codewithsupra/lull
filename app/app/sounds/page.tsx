import { SoundsClient } from "./sounds-client";

export default async function SoundsPage({ searchParams }: PageProps<"/app/sounds">) {
  const { preset, task } = await searchParams;
  return <SoundsClient initialPreset={typeof preset === "string" ? preset : undefined} taskId={typeof task === "string" ? task : undefined} />;
}
