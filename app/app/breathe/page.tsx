import { BreatheClient } from "./breathe-client";

export default async function BreathePage({ searchParams }: PageProps<"/app/breathe">) {
  const { pattern, minutes, task } = await searchParams;
  return (
    <BreatheClient
      initialPattern={typeof pattern === "string" ? pattern : undefined}
      initialMinutes={typeof minutes === "string" ? Number(minutes) : undefined}
      taskId={typeof task === "string" ? task : undefined}
    />
  );
}
