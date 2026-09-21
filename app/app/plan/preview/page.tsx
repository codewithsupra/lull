import { notFound } from "next/navigation";
import { PlanPreview } from "./plan-preview";

// Dev-only visual harness with mock data. Never available in production.
export default async function Page({ searchParams }: PageProps<"/app/plan/preview">) {
  if (process.env.NODE_ENV === "production") notFound();
  const { view } = await searchParams;
  return <PlanPreview view={view === "wizard" ? "wizard" : "home"} />;
}
